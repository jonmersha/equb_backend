const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  console.log('Connecting to databases...');
  
  // Connection to old DB (amarachm_sacco_db)
  const oldDb = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'amarachm_sacco_db'
  });

  // Connection to new DB (equb)
  const newDb = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'equb'
  });

  console.log('Fetching old equbs...');
  const [rows] = await oldDb.query('SELECT doc_id, data FROM documents WHERE collection_name = "equbs"');
  
  console.log(`Found ${rows.length} equbs to migrate.`);

  for (const row of rows) {
    const id = row.doc_id;
    let data;
    try {
      data = JSON.parse(row.data);
    } catch (e) {
      console.error(`Failed to parse data for equb ${id}`);
      continue;
    }

    console.log(`Migrating equb: ${data.name} (${id})`);

    // Insert Equb
    try {
      await newDb.query(`
        INSERT IGNORE INTO equbs (
          id, creatorId, name, paymentAmount, poolSize, frequency, startDate, nextDrawDate, status, currentRound
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, 
        data.creatorId || 'unknown',
        data.name,
        data.paymentAmount,
        data.poolSize,
        data.frequency,
        data.startDate,
        data.nextDrawDate || data.startDate,
        data.status || 'pending',
        data.currentRound || 1
      ]);
    } catch (e) {
      console.error(`Error inserting equb ${id}:`, e.message);
    }

    // Insert Members
    if (Array.isArray(data.members)) {
      for (const m of data.members) {
        try {
          await newDb.query(`
            INSERT IGNORE INTO equb_members (
              id, equbId, name, phone, isDrawn, drawnRound, kycVerified, bankLinked, hasDefaulted, trustScore, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            m.id,
            id,
            m.name,
            m.phone || '',
            m.isDrawn ? 1 : 0,
            m.drawnRound || null,
            m.kycVerified ? 1 : 0,
            m.bankLinked ? 1 : 0,
            m.hasDefaulted ? 1 : 0,
            m.trustScore || 0,
            m.status || 'approved'
          ]);
        } catch (e) {
          console.error(`Error inserting member ${m.id} for equb ${id}:`, e.message);
        }
      }
    }

    // Insert Payments
    if (Array.isArray(data.payments)) {
      for (const p of data.payments) {
        const round = p.round;
        if (Array.isArray(p.paidMemberIds)) {
          for (const memberId of p.paidMemberIds) {
            try {
              await newDb.query(`
                INSERT IGNORE INTO equb_payments (
                  equbId, round, memberId
                ) VALUES (?, ?, ?)
              `, [id, round, memberId]);
            } catch (e) {
              console.error(`Error inserting payment for member ${memberId} in equb ${id} round ${round}:`, e.message);
            }
          }
        }
      }
    }
  }

  console.log('Migration completed successfully.');
  await oldDb.end();
  await newDb.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
