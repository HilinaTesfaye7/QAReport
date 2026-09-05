-- ==============================================================================
-- AegisQA Platform - Supabase PostgreSQL Schema
-- Run this script in the Supabase SQL Editor (SQL Editor -> New query -> Run)
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Testing',
  start_date TEXT,
  target_release_date TEXT,
  project_owner TEXT,
  qa_lead_id TEXT,
  member_ids JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '{}'::jsonb,
  qa_progress NUMERIC DEFAULT 0,
  regression_progress NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TELEGRAM PROFILES TABLE
CREATE TABLE IF NOT EXISTS telegram_profiles (
  chat_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  project_id TEXT,
  project_name TEXT,
  assigned_project_ids JSONB DEFAULT '[]'::jsonb,
  assigned_projects JSONB DEFAULT '[]'::jsonb,
  telegram_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DAILY STANDUP REPORTS TABLE
CREATE TABLE IF NOT EXISTS daily_reports (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  chat_id TEXT,
  member_id TEXT,
  member_name TEXT NOT NULL,
  role TEXT,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  yesterday_completed TEXT,
  today_working_on TEXT,
  blockers TEXT,
  is_blocked BOOLEAN DEFAULT FALSE,
  expected_completion TEXT,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BLOCKERS TABLE
CREATE TABLE IF NOT EXISTS blockers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT NOT NULL,
  project_name TEXT,
  severity TEXT DEFAULT 'High',
  status TEXT DEFAULT 'Open',
  reported_by TEXT,
  chat_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. QA TASKS TABLE
CREATE TABLE IF NOT EXISTS qa_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT NOT NULL,
  module TEXT,
  assignee_id TEXT,
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Assigned',
  due_date TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. QA BUGS TABLE
CREATE TABLE IF NOT EXISTS qa_bugs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT DEFAULT 'Major',
  priority TEXT DEFAULT 'High',
  status TEXT DEFAULT 'Open',
  project_id TEXT NOT NULL,
  module TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allows seamless read and write access for both web client and Telegram bot
-- ==============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated users to perform all operations
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['projects', 'telegram_profiles', 'daily_reports', 'blockers', 'qa_tasks', 'qa_bugs', 'notifications'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public access for %I" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "Public access for %I" ON %I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- Enable Realtime for live updates on projects, standups, and blockers
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE blockers;
ALTER PUBLICATION supabase_realtime ADD TABLE telegram_profiles;

-- ==============================================================================
-- INITIAL SEED DATA
-- Pre-populates projects and user profile
-- ==============================================================================

INSERT INTO projects (id, name, description, status, start_date, target_release_date, project_owner, qa_lead_id, member_ids, qa_progress, regression_progress, resources)
VALUES
(
  'prj-banking',
  'Banking SuperApp',
  'Next-generation retail banking application with instant payments, multi-currency wallets, and biometric authentication.',
  'Testing',
  '2026-08-01',
  '2026-09-12',
  'David Chen (VP Product)',
  'usr-sarah',
  '["usr-hana", "usr-ahmed", "usr-daniel", "usr-347835367"]'::jsonb,
  74,
  62,
  '{
    "prdTitle": "PRD v2.4: Instant Wire Transfer & Biometric Core",
    "prdUrl": "https://docs.bankcorp.internal/prd/superapp-v2.4",
    "prdContent": "# Banking SuperApp v2.4 PRD\nFull biometric authentication and low latency transfers.",
    "figmaUrl": "https://www.figma.com/file/aegis-banking-superapp-hifi/v2.4",
    "figmaName": "SuperApp Design System & Transfer Flow v2.4",
    "figmaPreviewTitle": "SuperApp UI Kit & Interactive Transfer Flows (Figma v2.4)",
    "requirements": ["REQ-101: Biometrics", "REQ-102: Instant Wire Transfer"],
    "testEnvUrl": "https://staging-app.bankingsuperapp.internal",
    "repoUrl": "https://github.com/bankcorp/superapp-client"
  }'::jsonb
),
(
  'prj-mobile',
  'Mobile Banking iOS & Android',
  'Cross-platform native mobile client focusing on card management, contactless NFC payments, and push security tokens.',
  'UAT',
  '2026-07-15',
  '2026-09-18',
  'Elena Rostova (Mobile Director)',
  'usr-sarah',
  '["usr-hana", "usr-sara"]'::jsonb,
  81,
  78,
  '{
    "prdTitle": "PRD Mobile v3.1: Virtual Card Issuance & NFC",
    "prdUrl": "https://docs.bankcorp.internal/prd/mobile-v3.1",
    "prdContent": "# Mobile Banking v3.1 Specifications\nSupport Apple Pay and Google Wallet instant push provisioning.",
    "figmaUrl": "https://www.figma.com/file/aegis-mobile-cards/v3.1",
    "figmaName": "Mobile Cards & Wallet Flow v3.1",
    "figmaPreviewTitle": "Mobile Native Components & Virtual Card Flow",
    "requirements": ["REQ-M01: Virtual card generation within 2 seconds"],
    "testEnvUrl": "https://mobile-stage.bankingsuperapp.internal",
    "repoUrl": "https://github.com/bankcorp/mobile-native"
  }'::jsonb
),
(
  'prj-merchant',
  'Merchant Payment Gateway',
  'B2B web dashboard for e-commerce and retail merchants to manage settlements, chargebacks, and API webhook integrations.',
  'Planning',
  '2026-08-20',
  '2026-10-05',
  'Marcus Vance (Fintech Ops)',
  'usr-sarah',
  '["usr-sara", "usr-ahmed"]'::jsonb,
  35,
  15,
  '{
    "prdTitle": "PRD Merchant Portal v1.0: Real-time Analytics & Dispute Center",
    "prdUrl": "https://docs.bankcorp.internal/prd/merchant-portal-v1",
    "prdContent": "# Merchant Portal v1.0 PRD\nUnified settlement report download in CSV/XLSX.",
    "figmaUrl": "https://www.figma.com/file/aegis-merchant-v1/design",
    "figmaName": "Merchant Portal v1.0 Web App",
    "figmaPreviewTitle": "Merchant B2B Dashboard Layout & Dispute Flow",
    "requirements": ["REQ-B01: Dispute evidence upload"],
    "testEnvUrl": "https://staging-merchant.bankingsuperapp.internal",
    "repoUrl": "https://github.com/bankcorp/merchant-web"
  }'::jsonb
),
(
  'prj-nextgen',
  'NextGen Mobile Banking',
  'Next-generation mobile retail banking app with biometric authentication and card controls.',
  'Testing',
  '2026-09-01',
  '2026-10-15',
  'David Chen',
  'usr-sarah',
  '["usr-347835367", "usr-sarah", "usr-hana"]'::jsonb,
  20,
  10,
  '{
    "prdTitle": "NextGen Mobile Banking Functional Specifications",
    "prdUrl": "https://docs.bank.internal/prd/nextgen",
    "prdContent": "# NextGen Mobile Banking Acceptance Criteria\nComprehensive QA validation of all feature modules.",
    "figmaUrl": "https://www.figma.com/file/nextgen/spec",
    "figmaName": "NextGen UI Prototype",
    "figmaPreviewTitle": "NextGen UI/UX Specifications",
    "requirements": ["REQ-01: Biometrics", "REQ-02: Instant wire"],
    "testEnvUrl": "https://staging-nextgen.internal",
    "repoUrl": "https://github.com/bankcorp/nextgen"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  member_ids = EXCLUDED.member_ids,
  resources = EXCLUDED.resources,
  updated_at = NOW();

-- Seed initial Telegram Profile for Coco
INSERT INTO telegram_profiles (chat_id, full_name, role, project_id, project_name, assigned_project_ids, assigned_projects, telegram_username)
VALUES (
  '347835367',
  'Coco',
  'tester',
  'prj-banking',
  'Banking SuperApp',
  '["prj-banking", "prj-nextgen"]'::jsonb,
  '["Banking SuperApp", "NextGen Mobile Banking"]'::jsonb,
  'Helu777'
)
ON CONFLICT (chat_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  project_id = EXCLUDED.project_id,
  project_name = EXCLUDED.project_name,
  assigned_project_ids = EXCLUDED.assigned_project_ids,
  assigned_projects = EXCLUDED.assigned_projects,
  updated_at = NOW();
