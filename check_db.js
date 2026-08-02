const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_8AMd1lYGwUjk@ep-jolly-mud-aog9xjct-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect()
  .then(() => client.query('SELECT * FROM "Article" LIMIT 1'))
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => client.end());
