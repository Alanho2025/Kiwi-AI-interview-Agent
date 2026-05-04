import { query } from './src/db/postgres.js';
query('DROP TABLE IF EXISTS document_chunks;').then(() => {
  import('./src/db/bootstrap.js').then(({ bootstrapDatabases }) => {
    return bootstrapDatabases({ postgresRequired: true });
  }).then(() => {
    console.log('DB Bootstrapped successfully');
    process.exit(0);
  });
});
