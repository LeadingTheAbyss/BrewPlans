require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('SELECT * FROM "Article" LIMIT 1'))
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => client.end());
