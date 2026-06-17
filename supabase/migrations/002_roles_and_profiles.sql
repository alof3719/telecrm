-- ============================================================
-- TeleCRM Migration 002: User Profiles & Admin Roles
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email   TEXT,
  role    TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auto-create a profile whenever a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Back-fill profiles for any users that already exist
INSERT INTO profiles (id, email, role)
SELECT id, email, 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read all profiles (needed to check roles)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

-- Only admins can update roles
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Restrict DELETE on clients to admins only
--    (Drop existing permissive delete policy if any, then create admin-only one)
DROP POLICY IF EXISTS "clients_delete" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;
CREATE POLICY "clients_admin_delete" ON clients
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. IMPORTANT: Make yourself admin
--    Replace the email below with your own email, then run this block.
UPDATE profiles SET role = 'admin'
WHERE email = 'YOUR_EMAIL_HERE@example.com';
