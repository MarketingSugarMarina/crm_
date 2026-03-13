// routes/deals.js — Deals REST API
// Base path: /api/deals (กำหนดใน server.js)
//
// Endpoints:
//   GET    /           — รายการ deals ทั้งหมด (JOIN contacts)
//   GET    /pipeline   — สรุปมูลค่าแต่ละ stage
//   POST   /           — สร้าง deal ใหม่
//   PUT    /:id        — แก้ไข deal
//   DELETE /:id        — ลบ deal

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ─── GET /api/deals ───────────────────────────────────────────────────────────
// ดึง deals ทั้งหมด พร้อม JOIN ชื่อ + company ของ contact
// Query params:
//   ?stage=proposal   — filter ตาม stage
//   ?contact_id=3     — filter ตาม contact
router.get('/', async (req, res) => {
  try {
    const { stage, contact_id } = req.query;

    const conditions = [];
    const params     = [];

    if (stage) {
      params.push(stage);
      conditions.push(`d.stage = $${params.length}`);
    }

    if (contact_id) {
      params.push(contact_id);
      conditions.push(`d.contact_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const result = await pool.query(
      `SELECT
         d.*,
         c.name    AS contact_name,
         c.company AS contact_company,
         c.email   AS contact_email
       FROM deals d
       LEFT JOIN contacts c ON d.contact_id = c.id
       ${whereClause}
       ORDER BY d.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /deals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// ─── GET /api/deals/pipeline ──────────────────────────────────────────────────
// คืนสรุปมูลค่าของแต่ละ stage สำหรับแสดง pipeline view
// ⚠️ ต้องอยู่เหนือ /:id เสมอ
router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        stage,
        COUNT(*)::INTEGER          AS count,
        COALESCE(SUM(value), 0)   AS total_value
      FROM deals
      GROUP BY stage
      ORDER BY
        CASE stage
          WHEN 'new'         THEN 1
          WHEN 'contacted'   THEN 2
          WHEN 'proposal'    THEN 3
          WHEN 'negotiation' THEN 4
          WHEN 'won'         THEN 5
          WHEN 'lost'        THEN 6
          ELSE 7
        END
    `);

    // Grand total เฉพาะ active stages (ไม่นับ won/lost)
    const activeStages  = ['new', 'contacted', 'proposal', 'negotiation'];
    const pipeline_value = result.rows
      .filter(r => activeStages.includes(r.stage))
      .reduce((sum, r) => sum + parseFloat(r.total_value), 0);

    res.json({
      stages:         result.rows,
      pipeline_value, // มูลค่ารวมที่กำลัง active
    });
  } catch (err) {
    console.error('GET /deals/pipeline error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// ─── POST /api/deals ──────────────────────────────────────────────────────────
// สร้าง deal ใหม่
// Body: { title*, contact_id, value, stage, close_date, notes }
router.post('/', async (req, res) => {
  try {
    const { title, contact_id, value, stage, close_date, notes } = req.body;

    // Validate required field
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }

    const result = await pool.query(
      `INSERT INTO deals (title, contact_id, value, stage, close_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        contact_id  || null,
        value       || 0,
        stage       || 'new',
        close_date  || null,
        notes       || null,
      ]
    );

    // ดึง contact name มาแนบใน response ด้วย
    const deal = result.rows[0];
    if (deal.contact_id) {
      const cResult = await pool.query(
        'SELECT name, company FROM contacts WHERE id = $1',
        [deal.contact_id]
      );
      if (cResult.rows.length > 0) {
        deal.contact_name    = cResult.rows[0].name;
        deal.contact_company = cResult.rows[0].company;
      }
    }

    res.status(201).json(deal);
  } catch (err) {
    console.error('POST /deals error:', err.message);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// ─── PUT /api/deals/:id ───────────────────────────────────────────────────────
// แก้ไข deal
// Body: { title*, contact_id, value, stage, close_date, notes }
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, contact_id, value, stage, close_date, notes } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }

    const result = await pool.query(
      `UPDATE deals
       SET title      = $1,
           contact_id = $2,
           value      = $3,
           stage      = $4,
           close_date = $5,
           notes      = $6
       WHERE id = $7
       RETURNING *`,
      [
        title.trim(),
        contact_id || null,
        value      || 0,
        stage      || 'new',
        close_date || null,
        notes      || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /deals/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// ─── DELETE /api/deals/:id ────────────────────────────────────────────────────
// ลบ deal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM deals WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json({ message: 'Deal deleted', deal: result.rows[0] });
  } catch (err) {
    console.error('DELETE /deals/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

module.exports = router;
