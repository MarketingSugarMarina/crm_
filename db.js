// db.js — PostgreSQL connection + schema init + seed data
// ออกแบบสำหรับ Railway (ใช้ DATABASE_URL + SSL)

require('dotenv').config();

const { Pool } = require('pg');

// ─── Connection Pool ──────────────────────────────────────────────────────────
// Railway ให้ DATABASE_URL มาในรูป postgres://user:pass@host:port/dbname
// ssl: rejectUnauthorized: false — จำเป็นสำหรับ Railway's managed PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }  // Railway / cloud
    : false,                          // local dev ไม่ต้อง SSL
});

// ─── initDB() — สร้างตารางถ้ายังไม่มี ────────────────────────────────────────
async function initDB() {
  // ใช้ single client จาก pool เพื่อให้ทั้ง 2 CREATE TABLE รันใน session เดียวกัน
  const client = await pool.connect();
  try {
    // ── ตาราง contacts ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        company    VARCHAR(100),
        email      VARCHAR(100),
        phone      VARCHAR(20),
        status     VARCHAR(20)  DEFAULT 'lead'
                   CHECK (status IN ('lead', 'prospect', 'customer', 'inactive')),
        tags       TEXT,
        notes      TEXT,
        created_at TIMESTAMP    DEFAULT NOW(),
        updated_at TIMESTAMP    DEFAULT NOW()
      );
    `);

    // ── ตาราง deals ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS deals (
        id         SERIAL PRIMARY KEY,
        contact_id INTEGER      REFERENCES contacts(id) ON DELETE SET NULL,
        title      VARCHAR(200) NOT NULL,
        value      DECIMAL(10,2) DEFAULT 0,
        stage      VARCHAR(30)  DEFAULT 'new'
                   CHECK (stage IN ('new', 'contacted', 'proposal', 'negotiation', 'won', 'lost')),
        close_date DATE,
        notes      TEXT,
        created_at TIMESTAMP    DEFAULT NOW()
      );
    `);

    console.log('✅ Database tables ready');
  } finally {
    client.release(); // คืน client กลับ pool เสมอ แม้จะ error
  }
}

// ─── seedData() — ใส่ข้อมูลตัวอย่าง (รันครั้งเดียว) ─────────────────────────
async function seedData() {
  const client = await pool.connect();
  try {
    // ตรวจว่ามีข้อมูลอยู่แล้วหรือยัง — ถ้ามีแล้วข้าม seed
    const { rows } = await client.query('SELECT COUNT(*) FROM contacts');
    if (parseInt(rows[0].count) > 0) {
      console.log('ℹ️  Seed skipped — data already exists');
      return;
    }

    // ── Insert 10 sample contacts ─────────────────────────────────────────────
    // RETURNING id เพื่อนำ id ไปสร้าง deals ที่ผูกกัน
    const contactResult = await client.query(`
      INSERT INTO contacts (name, company, email, phone, status, tags, notes)
      VALUES
        ('สมชาย ใจดี',    'ABC Trading Co.',       'somchai@abc.co.th',    '081-234-5678', 'customer',  'enterprise,retail',    'ลูกค้าประจำ ซื้อทุกไตรมาส'),
        ('สมหญิง รักดี',  'XYZ Corporation',       'somying@xyz.com',      '089-876-5432', 'prospect',  'startup,tech',         'สนใจ package Premium'),
        ('วิชัย มั่งมี',   'Wealth Finance Ltd.',   'wichai@wealth.co.th',  '062-345-6789', 'customer',  'finance,enterprise',   'ต้องการ custom integration'),
        ('นภา สดใส',     'Bright Media Group',    'napa@brightmedia.th',  '091-456-7890', 'lead',      'media,sme',            'ติดต่อจาก LinkedIn'),
        ('ประเสริฐ ดีงาม', 'Prasert Consulting',    'prasert@consult.co.th','083-567-8901', 'prospect',  'consulting,b2b',       'นัด demo สัปดาห์หน้า'),
        ('กนกวรรณ แสงทอง','Golden Star Import',    'kanok@goldenstar.com', '076-678-9012', 'inactive',  'import,retail',        'หยุดใช้งาน Q3 ปีที่แล้ว'),
        ('ธนกร สมบูรณ์',  'ThanaCorp Holdings',    'thanakorn@thanacorp.th','087-789-0123','customer',  'holding,enterprise',   'VIP account'),
        ('รัชนี พูลสุข',   'Ratchanee Beauty Co.',  'ratchanee@beauty.co.th','092-890-1234','lead',     'beauty,sme',           'รับข้อมูลจาก Trade Show'),
        ('อภิชาต วงศ์ดี', 'Apichat Digital Agency','apichat@digital.co.th','095-901-2345','prospect',  'agency,digital',       'ต้องการ API integration'),
        ('มณีรัตน์ สว่าง', 'Manee Retail Chain',    'manee@maneeretail.com','098-012-3456','customer',  'retail,franchise',     'มี 12 สาขา ต้องการ multi-user')
      RETURNING id;
    `);

    // ดึง id ของ contacts ที่เพิ่งสร้าง (index 0–9)
    const ids = contactResult.rows.map(r => r.id);

    // ── Insert 5 sample deals ─────────────────────────────────────────────────
    await client.query(`
      INSERT INTO deals (contact_id, title, value, stage, close_date, notes)
      VALUES
        ($1, 'Enterprise CRM Package — ABC Trading',   850000, 'negotiation', '2026-04-30', 'รอ approve จาก CFO'),
        ($2, 'Premium Subscription 12 months',         144000, 'proposal',    '2026-03-31', 'ส่ง proposal ไปแล้ว รอ feedback'),
        ($3, 'Custom API Integration Project',         320000, 'contacted',   '2026-05-15', 'ประชุมครั้งแรกเสร็จแล้ว'),
        ($4, 'ThanaCorp Multi-site License',          1200000, 'won',         '2026-02-28', 'เซ็นสัญญาแล้ว เริ่ม onboard'),
        ($5, 'Digital Agency Partner Plan',             96000, 'new',         '2026-06-01', 'ส่ง intro email แล้ว')
      `,
      // ใช้ parameterized query — ป้องกัน SQL injection
      [ids[0], ids[1], ids[2], ids[6], ids[8]]
    );

    console.log(`✅ Seed complete — ${ids.length} contacts, 5 deals inserted`);
  } finally {
    client.release();
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { pool, initDB, seedData };
