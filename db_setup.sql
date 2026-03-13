-- db_setup.sql — สร้าง tables สำหรับ CRM database
-- รัน: psql -U postgres -d crm_db -f db_setup.sql

-- สร้าง database (รันแยกหากยังไม่มี)
-- CREATE DATABASE crm_db;

-- ─── Contacts table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255),
  phone      VARCHAR(50),
  company    VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── Deals table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  value      NUMERIC(15, 2) DEFAULT 0,
  stage      VARCHAR(50) DEFAULT 'lead'
               CHECK (stage IN ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── Sample data (optional) ────────────────────────────────────────────────────
INSERT INTO contacts (name, email, phone, company) VALUES
  ('สมชาย ใจดี',  'somchai@example.com', '081-234-5678', 'ABC Co., Ltd.'),
  ('สมหญิง รักดี', 'somying@example.com', '089-876-5432', 'XYZ Corp');

INSERT INTO deals (title, value, stage, contact_id) VALUES
  ('โปรเจกต์ระบบ ERP',  500000, 'proposal',    1),
  ('ซอฟต์แวร์บัญชี',    150000, 'negotiation', 2),
  ('Website Redesign',  80000,  'lead',         1);
