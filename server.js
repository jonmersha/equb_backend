const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Pass the pool to routes via req
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Routes
app.use('/api/equbs', require('./routes/equbs'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'equb-backend', db: 'mysql' });
});

const initDB = require('./init_mysql');

const PORT = process.env.PORT || 3002;

// Initialize Database then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Equb Backend running on http://localhost:${PORT}`);
  });
});
