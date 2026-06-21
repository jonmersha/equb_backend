const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDB() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log("Connected to MySQL DB.");

    // Drop existing tables if they exist
    await conn.query('DROP TABLE IF EXISTS equb_payments');
    await conn.query('DROP TABLE IF EXISTS equb_members');
    await conn.query('DROP TABLE IF EXISTS equbs');

    // Create equbs table
    await conn.query(`
      CREATE TABLE equbs (
        id VARCHAR(50) PRIMARY KEY,
        creatorId VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        paymentAmount INT NOT NULL,
        poolSize INT NOT NULL,
        frequency ENUM('daily', 'weekly', 'monthly') NOT NULL,
        startDate VARCHAR(50) NOT NULL,
        nextDrawDate VARCHAR(50) NOT NULL,
        status ENUM('pending', 'active', 'completed') DEFAULT 'pending',
        currentRound INT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("Created equbs table.");

    // Create equb_members table
    await conn.query(`
      CREATE TABLE equb_members (
        id VARCHAR(50) PRIMARY KEY,
        equbId VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        isDrawn BOOLEAN DEFAULT FALSE,
        drawnRound INT DEFAULT NULL,
        kycVerified BOOLEAN DEFAULT FALSE,
        bankLinked BOOLEAN DEFAULT FALSE,
        hasDefaulted BOOLEAN DEFAULT FALSE,
        trustScore INT DEFAULT 0,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
        FOREIGN KEY (equbId) REFERENCES equbs(id) ON DELETE CASCADE
      )
    `);
    console.log("Created equb_members table.");

    // Create equb_payments table
    await conn.query(`
      CREATE TABLE equb_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        equbId VARCHAR(50) NOT NULL,
        round INT NOT NULL,
        memberId VARCHAR(50) NOT NULL,
        FOREIGN KEY (equbId) REFERENCES equbs(id) ON DELETE CASCADE,
        FOREIGN KEY (memberId) REFERENCES equb_members(id) ON DELETE CASCADE,
        UNIQUE KEY unique_payment (equbId, round, memberId)
      )
    `);
    console.log("Created equb_payments table.");

    console.log("✅ All required tables created successfully!");

  } catch (error) {
    console.error("❌ Failed to create tables:", error);
  } finally {
    if (conn) await conn.end();
  }
}

initDB();
