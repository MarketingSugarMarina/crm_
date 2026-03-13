// server.js — Entry point ของ Express server
// รับผิดชอบ: middleware setup, route registration, static file serving

require('dotenv').config(); // โหลด .env ก่อนทุกอย่าง

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Import DB init functions และ route handlers
const { initDB, seedData } = require('./db');
const contactsRouter       = require('./routes/contacts');
const dealsRouter          = require('./routes/deals');

const app  = express();
const PORT = process.env.PORT || 3000; // ใช้ PORT จาก env หรือ fallback 3000

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());                        // อนุญาต cross-origin requests
app.use(express.json());                // parse JSON request body
app.use(express.urlencoded({ extended: true })); // parse form data

// Serve static files จากโฟลเดอร์ /public
// ทุก request ที่ไม่ match route จะไปหาไฟล์ใน public/ ก่อน
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/contacts', contactsRouter); // CRUD สำหรับ contacts
app.use('/api/deals',    dealsRouter);    // CRUD สำหรับ deals

// Health check endpoint — ใช้ตรวจสอบว่า server ทำงานอยู่
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: ส่ง index.html สำหรับทุก route ที่ไม่ใช่ API
// รองรับ Single Page Application (SPA) routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
// รัน initDB และ seedData ก่อน listen — ป้องกัน request เข้าก่อน table พร้อม
async function start() {
  await initDB();    // สร้าง tables (IF NOT EXISTS)
  await seedData();  // ใส่ข้อมูลตัวอย่าง (ข้ามถ้ามีแล้ว)

  app.listen(PORT, () => {
    console.log(`🚀 CRM server running at http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start().catch(err => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
