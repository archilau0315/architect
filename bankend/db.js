require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'kbitai0302',
  password: process.env.DB_PASSWORD || 'kbitai2026',
  database: process.env.DB_NAME || 'kbitai0302',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
