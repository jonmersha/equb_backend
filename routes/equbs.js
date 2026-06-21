const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('crypto') || { v4: () => Math.random().toString(36).substring(2, 9) };

// Helper to fetch full equb with members and payments
async function getEqubDetails(db, equbId) {
  const [equbs] = await db.query('SELECT * FROM equbs WHERE id = ?', [equbId]);
  if (!equbs.length) return null;
  const equb = equbs[0];

  const [members] = await db.query('SELECT * FROM equb_members WHERE equbId = ?', [equbId]);
  
  // Format members
  equb.members = members.map(m => ({
    ...m,
    isDrawn: Boolean(m.isDrawn),
    kycVerified: Boolean(m.kycVerified),
    bankLinked: Boolean(m.bankLinked),
    hasDefaulted: Boolean(m.hasDefaulted)
  }));

  const [paymentsRows] = await db.query('SELECT * FROM equb_payments WHERE equbId = ?', [equbId]);
  // Group payments by round
  const paymentsByRound = {};
  paymentsRows.forEach(p => {
    if (!paymentsByRound[p.round]) {
      paymentsByRound[p.round] = { round: p.round, paidMemberIds: [] };
    }
    paymentsByRound[p.round].paidMemberIds.push(p.memberId);
  });
  equb.payments = Object.values(paymentsByRound);

  return equb;
}

// GET /api/equbs?userId=<uid>
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = 'SELECT * FROM equbs';
    let params = [];
    if (userId) {
      query += ' WHERE creatorId = ?';
      params.push(userId);
    }
    query += ' ORDER BY createdAt DESC';
    const [rows] = await req.db.query(query, params);
    
    // We need to fetch details for all
    const fullEqubs = await Promise.all(rows.map(row => getEqubDetails(req.db, row.id)));
    
    res.json(fullEqubs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/equbs
router.post('/', async (req, res) => {
  try {
    const { creatorId, name, paymentAmount, poolSize, frequency, startDate, nextDrawDate } = req.body;
    const id = Math.random().toString(36).substring(2, 10);
    
    await req.db.query(
      `INSERT INTO equbs (id, creatorId, name, paymentAmount, poolSize, frequency, startDate, nextDrawDate, status, currentRound) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)`,
      [id, creatorId, name, paymentAmount, poolSize, frequency, startDate, nextDrawDate]
    );

    const saved = await getEqubDetails(req.db, id);
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/equbs/:id
router.get('/:id', async (req, res) => {
  try {
    const equb = await getEqubDetails(req.db, req.params.id);
    if (!equb) return res.status(404).json({ error: 'Equb not found' });
    res.json(equb);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/equbs/:id/join
router.post('/:id/join', async (req, res) => {
  try {
    const id = req.params.id;
    const { userId, name, phone } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' });
    }

    // Use INSERT IGNORE to prevent duplicate entries if the user already joined
    await req.db.query(`
      INSERT IGNORE INTO equb_members 
      (id, equbId, name, phone, isDrawn, kycVerified, bankLinked, hasDefaulted, trustScore, status)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'pending')
    `, [
      userId, // using userId as member id to avoid duplicates
      id,
      name,
      phone || ''
    ]);

    const updated = await getEqubDetails(req.db, id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/equbs/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.db.query('DELETE FROM equbs WHERE id = ?', [req.params.id]);
    res.json({ message: 'Equb deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/equbs/:id - Updates status, currentRound, nextDrawDate, members, payments
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { status, currentRound, nextDrawDate, members, payments } = req.body;
    const conn = await req.db.getConnection();
    await conn.beginTransaction();

    try {
      if (status || currentRound || nextDrawDate) {
        const updates = [];
        const params = [];
        if (status) { updates.push('status = ?'); params.push(status); }
        if (currentRound !== undefined) { updates.push('currentRound = ?'); params.push(currentRound); }
        if (nextDrawDate) { updates.push('nextDrawDate = ?'); params.push(nextDrawDate); }
        params.push(id);
        
        await conn.query(`UPDATE equbs SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      // Sync members if provided
      if (members) {
        await conn.query('DELETE FROM equb_members WHERE equbId = ?', [id]);
        for (const m of members) {
          await conn.query(`
            INSERT INTO equb_members 
            (id, equbId, name, phone, isDrawn, drawnRound, kycVerified, bankLinked, hasDefaulted, trustScore, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            m.id || Math.random().toString(36).substring(2, 9), 
            id, m.name, m.phone || '', 
            m.isDrawn ? 1 : 0, m.drawnRound || null, 
            m.kycVerified ? 1 : 0, m.bankLinked ? 1 : 0, 
            m.hasDefaulted ? 1 : 0, m.trustScore || 0, 
            m.status || 'approved'
          ]);
        }
      }

      // Sync payments if provided
      if (payments) {
        await conn.query('DELETE FROM equb_payments WHERE equbId = ?', [id]);
        for (const p of payments) {
          for (const memberId of p.paidMemberIds) {
            await conn.query(`
              INSERT INTO equb_payments (equbId, round, memberId) VALUES (?, ?, ?)
            `, [id, p.round, memberId]);
          }
        }
      }

      await conn.commit();
      conn.release();

      const updated = await getEqubDetails(req.db, id);
      res.json(updated);

    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
