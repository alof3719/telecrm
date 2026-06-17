-- ============================================================
-- TeleCRM Migration 003: Multi-Tenancy (one system, many businesses)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Users can only see their own company
DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── 2. Add company_id to profiles & clients ──────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- ── 3. Seed your own company and link all existing data ───────
-- This creates a company for the original admin and migrates existing data.

WITH seed AS (
  INSERT INTO companies (name) VALUES ('My Company') RETURNING id
)
UPDATE profiles SET company_id = (SELECT id FROM seed);

-- Link all existing clients to the same company
UPDATE clients
SET company_id = (SELECT company_id FROM profiles WHERE email = 'alof3719@gmail.com')
WHERE company_id IS NULL;

-- ── 4. Update RLS on profiles ────────────────────────────────
-- Users can only see profiles in their own company
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    company_id = (SELECT company_id FROM profiles p2 WHERE p2.id = auth.uid())
  );

-- Admins can update roles within their own company only
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM profiles p2 WHERE p2.id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles p3 WHERE p3.id = auth.uid() AND p3.role = 'admin')
  );

-- ── 5. Update RLS on clients ─────────────────────────────────
DROP POLICY IF EXISTS "Users can read all clients"   ON clients;
DROP POLICY IF EXISTS "clients_select"               ON clients;
DROP POLICY IF EXISTS "Users can insert clients"     ON clients;
DROP POLICY IF EXISTS "clients_insert"               ON clients;
DROP POLICY IF EXISTS "Users can update clients"     ON clients;
DROP POLICY IF EXISTS "clients_update"               ON clients;
DROP POLICY IF EXISTS "clients_admin_delete"         ON clients;

CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Delete still admin-only, but now also company-scoped
CREATE POLICY "clients_admin_delete" ON clients
  FOR DELETE USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 6. Update RLS on notes (scoped via client relationship) ──
DROP POLICY IF EXISTS "notes_select" ON notes;
DROP POLICY IF EXISTS "notes_insert" ON notes;
DROP POLICY IF EXISTS "Users can read notes"   ON notes;
DROP POLICY IF EXISTS "Users can insert notes" ON notes;

CREATE POLICY "notes_select" ON notes
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "notes_insert" ON notes
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM clients
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── 7. Update RLS on call_logs (scoped via client) ───────────
DROP POLICY IF EXISTS "call_logs_select" ON call_logs;
DROP POLICY IF EXISTS "Users can read call_logs" ON call_logs;

CREATE POLICY "call_logs_select" ON call_logs
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients
      WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── HOW TO ONBOARD A NEW BUSINESS (e.g. "Business A") ────────
--
-- Step 1: Create their company
--   INSERT INTO companies (name) VALUES ('Business A') RETURNING id;
--   → Copy the UUID returned.
--
-- Step 2: Invite their admin via Supabase dashboard
--   Authentication → Users → Invite user → enter their email
--
-- Step 3: After they accept the invite, link them to the company
--   UPDATE profiles
--   SET company_id = '<UUID from step 1>', role = 'admin'
--   WHERE email = 'businessA_admin@example.com';
--
-- That's it. Their admin can then invite their own team members
-- via the Users page in the app. All their data is fully isolated.
-- ─────────────────────────────────────────────────────────────
