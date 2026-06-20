import crypto from 'crypto';
import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

const BACKUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

const sanitizeCommandError = (value) => String(value || '')
  .replace(/(?:mongodb(?:\+srv)?|postgres(?:ql)?):\/\/\S+/gi, '[REDACTED_CONNECTION]')
  .slice(0, 4000);

export const runRetentionCommand = async ({ command, args = [], outputPath = null }) => {
  let outputHandle;
  try {
    if (outputPath) {
      await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
      outputHandle = await fsPromises.open(outputPath, 'w', 0o600);
    }
    await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', outputHandle ? outputHandle.fd : 'ignore', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-8000);
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} failed with exit code ${code}: ${sanitizeCommandError(stderr)}`));
      });
    });
    return { ok: true };
  } finally {
    await outputHandle?.close();
  }
};

const createHashingTransform = (hash) => new Transform({
  transform(chunk, _encoding, callback) {
    hash.update(chunk);
    callback(null, chunk);
  },
});

const encryptArchive = async ({ inputPath, encryptedPath, key }) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const plaintextHash = crypto.createHash('sha256');
  await pipeline(
    createReadStream(inputPath),
    createHashingTransform(plaintextHash),
    cipher,
    createWriteStream(encryptedPath, { mode: 0o600 }),
  );
  const [inputStat, encryptedStat] = await Promise.all([
    fsPromises.stat(inputPath),
    fsPromises.stat(encryptedPath),
  ]);
  return {
    encryptedPath,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    plaintextSha256: plaintextHash.digest('hex'),
    plaintextBytes: inputStat.size,
    encryptedBytes: encryptedStat.size,
  };
};

const decryptArchive = async ({ archive, outputPath, key }) => {
  const decipher = crypto.createDecipheriv(
    archive.algorithm,
    key,
    Buffer.from(archive.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(archive.authTag, 'base64'));
  const plaintextHash = crypto.createHash('sha256');
  await pipeline(
    createReadStream(archive.encryptedPath),
    decipher,
    createHashingTransform(plaintextHash),
    createWriteStream(outputPath, { mode: 0o600 }),
  );
  const stat = await fsPromises.stat(outputPath);
  if (stat.size !== archive.plaintextBytes || plaintextHash.digest('hex') !== archive.plaintextSha256) {
    throw new Error('Retention backup checksum verification failed');
  }
};

const removeIfPresent = async (filePath) => {
  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

export const createRetentionBackupService = ({
  backupRoot,
  keyRoot,
  temporaryRoot,
  runCommand = runRetentionCommand,
  now = () => new Date(),
}) => {
  const createAndVerify = async ({ runId, mongoUri, postgresUrl }) => {
    if (!runId || !mongoUri || !postgresUrl) {
      throw new Error('Retention backup requires runId and both database connection strings');
    }
    const directory = path.join(backupRoot, runId);
    const keyPath = path.join(keyRoot, `${runId}.backup.key`);
    const mongoRawPath = path.join(temporaryRoot, `${runId}-mongo.raw`);
    const postgresRawPath = path.join(temporaryRoot, `${runId}-postgres.raw`);
    const mongoVerifyPath = path.join(temporaryRoot, `${runId}-mongo.verify`);
    const postgresVerifyPath = path.join(temporaryRoot, `${runId}-postgres.verify`);
    const key = crypto.randomBytes(32);
    await Promise.all([
      fsPromises.mkdir(directory, { recursive: true }),
      fsPromises.mkdir(keyRoot, { recursive: true }),
      fsPromises.mkdir(temporaryRoot, { recursive: true }),
    ]);
    await fsPromises.writeFile(keyPath, key.toString('hex'), { mode: 0o600 });

    let mongoArchive;
    let postgresArchive;
    try {
      await runCommand({
        command: 'mongodump',
        args: [`--uri=${mongoUri}`, '--archive', '--gzip'],
        outputPath: mongoRawPath,
      });
      mongoArchive = await encryptArchive({
        inputPath: mongoRawPath,
        encryptedPath: path.join(directory, 'mongo.archive.gz.enc'),
        key,
      });
      await removeIfPresent(mongoRawPath);

      await runCommand({
        command: 'pg_dump',
        args: ['--format=custom', '--no-owner', '--no-privileges', postgresUrl],
        outputPath: postgresRawPath,
      });
      postgresArchive = await encryptArchive({
        inputPath: postgresRawPath,
        encryptedPath: path.join(directory, 'postgres.dump.enc'),
        key,
      });
      await removeIfPresent(postgresRawPath);

      await decryptArchive({ archive: mongoArchive, outputPath: mongoVerifyPath, key });
      await runCommand({
        command: 'mongorestore',
        args: [`--uri=${mongoUri}`, `--archive=${mongoVerifyPath}`, '--gzip', '--dryRun'],
      });
      await removeIfPresent(mongoVerifyPath);

      await decryptArchive({ archive: postgresArchive, outputPath: postgresVerifyPath, key });
      await runCommand({ command: 'pg_restore', args: ['--list', postgresVerifyPath] });
      await removeIfPresent(postgresVerifyPath);

      const createdAt = now();
      const result = {
        runId,
        verified: true,
        verifiedAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + BACKUP_RETENTION_MS).toISOString(),
        keyPath,
        archives: { mongo: mongoArchive, postgres: postgresArchive },
      };
      const verificationPath = path.join(directory, 'backup-verification.json');
      await fsPromises.writeFile(verificationPath, JSON.stringify(result, null, 2), { mode: 0o600 });
      return { ...result, verificationPath };
    } finally {
      await Promise.allSettled([
        removeIfPresent(mongoRawPath),
        removeIfPresent(postgresRawPath),
        removeIfPresent(mongoVerifyPath),
        removeIfPresent(postgresVerifyPath),
      ]);
    }
  };

  return { createAndVerify };
};
