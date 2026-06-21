const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  console.log("Testing MySQL...");
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log("MySQL connection successful!");
    conn.end();
  } catch(e) {
    console.log("MySQL connection failed:", e.message);
  }

  console.log("Testing PostgreSQL...");
  try {
    const client = new Client({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    await client.connect();
    console.log("PostgreSQL connection successful!");
    await client.end();
  } catch(e) {
    console.log("PostgreSQL connection failed:", e.message);
  }
}

testConnection();
