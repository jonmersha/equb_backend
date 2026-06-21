const express = require('express');
const router = express.Router();

// POST /api/users/sync
router.post('/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoUrl } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    // ON DUPLICATE KEY UPDATE ensures we insert if it doesn't exist,
    // but update the data (like lastLoginAt) if the user logs in again.
    const query = `
      INSERT INTO users (uid, email, displayName, photoUrl, lastLoginAt) 
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        email = VALUES(email),
        displayName = VALUES(displayName),
        photoUrl = VALUES(photoUrl),
        lastLoginAt = NOW()
    `;

    await req.db.query(query, [uid, email || null, displayName || null, photoUrl || null]);

    res.status(200).json({ message: 'User synced successfully' });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
