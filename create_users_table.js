require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      uid VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255),
      displayName VARCHAR(255),
      photoUrl VARCHAR(1024),
      lastLoginAt DATETIME
    )
  `);
  console.log("Users table created successfully.");
  process.exit(0);
}
run().catch(console.error);
