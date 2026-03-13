// routes/contacts.js — Contacts REST API
// Base path: /api/contacts (กำหนดใน server.js)
//
// Endpoints:
//   GET    /              — รายการทั้งหมด (?search= และ ?status=)
//   GET    /stats         — สรุปจำนวนแต่ละ status
//   GET    /:id           — ดู contact รายบุคคล
//   POST   /              — เพิ่มใหม่
//   PUT    /:id           — แก้ไข
//   DELETE /:id           — ลบ

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ─── GET /api/contacts ────────────────────────────────────────────────────────
// Query params:
//   ?search=keyword  — ค้นหาใน name, company, email (case-insensitive)
//   ?status=lead     — filter ตาม status
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;

    // สร้าง WHERE clause แบบ dynamic โดยเก็บ params ไว้ใน array
    // เพื่อใช้กับ parameterized query ($1, $2, ...)
    const conditions = [];
    const params     = [];

    if (search) {
      params.push(`%${search}%`);
      // ค้นหาใน 3 columns พร้อมกัน
      conditions.push(
        `(name ILIKE $${params.length}
          OR company ILIKE $${params.length}
          OR email   ILIKE $${params.length})`
      );
    }

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const result = await pool.query(
      `SELECT * FROM contacts
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /contacts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// ─── GET /api/contacts/stats ──────────────────────────────────────────────────
// คืนจำนวน contacts แต่ละ status + total
// ⚠️ ต้องอยู่เหนือ /:id — ไม่งั้น Express จะ match "stats" เป็น :id
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*)::INTEGER AS count
      FROM contacts
      GROUP BY status
      ORDER BY status
    `);

    // นับ total ทุก status รวมกัน
    const total = result.rows.reduce((sum, r) => sum + r.count, 0);

    res.json({ total, by_status: result.rows });
  } catch (err) {
    console.error('GET /contacts/stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/contacts/:id ────────────────────────────────────────────────────
// ดึง contact รายบุคคล พร้อม deals ที่เกี่ยวข้อง
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const contactResult = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [id]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // ดึง deals ของ contact นี้มาแนบด้วย
    const dealsResult = await pool.query(
      `SELECT id, title, value, stage, close_date
       FROM deals WHERE contact_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      ...contactResult.rows[0],
      deals: dealsResult.rows,
    });
  } catch (err) {
    console.error('GET /contacts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// ─── POST /api/contacts ───────────────────────────────────────────────────────
// สร้าง contact ใหม่
// Body: { name*, email*, company, phone, status, tags, notes }
router.post('/', async (req, res) => {
  try {
    const { name, email, company, phone, status, tags, notes } = req.body;

    // Validate required fields
    const errors = [];
    if (!name  || name.trim()  === '') errors.push('name is required');
    if (!email || email.trim() === '') errors.push('email is required');
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const result = await pool.query(
      `INSERT INTO contacts (name, email, company, phone, status, tags, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name.trim(),
        email.trim(),
        company || null,
        phone   || null,
        status  || 'lead',
        tags    || null,
        notes   || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /contacts error:', err.message);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// ─── PUT /api/contacts/:id ────────────────────────────────────────────────────
// แก้ไข contact — updated_at อัปเดตอัตโนมัติด้วย NOW()
// Body: { name*, email*, company, phone, status, tags, notes }
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, company, phone, status, tags, notes } = req.body;

    // Validate required fields
    const errors = [];
    if (!name  || name.trim()  === '') errors.push('name is required');
    if (!email || email.trim() === '') errors.push('email is required');
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const result = await pool.query(
      `UPDATE contacts
       SET name       = $1,
           email      = $2,
           company    = $3,
           phone      = $4,
           status     = $5,
           tags       = $6,
           notes      = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        name.trim(),
        email.trim(),
        company || null,
        phone   || null,
        status  || 'lead',
        tags    || null,
        notes   || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /contacts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// ─── DELETE /api/contacts/:id ─────────────────────────────────────────────────
// ลบ contact — deals ที่ผูกอยู่จะ SET NULL (กำหนดใน FK constraint)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted', contact: result.rows[0] });
  } catch (err) {
    console.error('DELETE /contacts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
