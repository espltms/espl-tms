-- Supabase security hardening for ESPL TMS.
-- Purpose:
-- 1. Enable Row Level Security on every table in the public schema.
-- 2. Remove direct browser/API table privileges from anon and authenticated roles.
--
-- The application currently accesses data through server-side API routes/Prisma.
-- Server-side database access using the project database connection will continue to work.
-- Direct Supabase REST access with the public anon key will be blocked unless explicit
-- RLS policies are added later.

DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      table_record.schemaname,
      table_record.tablename
    );

    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM anon',
      table_record.schemaname,
      table_record.tablename
    );

    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM authenticated',
      table_record.schemaname,
      table_record.tablename
    );
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- Verification query:
-- This should return zero rows after the script runs.
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
