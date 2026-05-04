import { bootstrapDatabases } from './src/db/bootstrap.js';
bootstrapDatabases({ postgresRequired: true }).then(() => {
  console.log('DB Bootstrapped successfully');
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
