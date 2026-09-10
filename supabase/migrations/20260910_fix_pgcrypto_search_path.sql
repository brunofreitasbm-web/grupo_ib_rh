-- Migration: 20260910_fix_pgcrypto_search_path.sql
-- Fixes PostgreSQL error: "function gen_random_bytes(integer) does not exist"
-- and "function digest(text, unknown) does not exist" during CLT and PJ self-registration
-- and time record registration by adding 'extensions' schema to search_path.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. CLT self registration function
ALTER FUNCTION public.create_employee_self_registration(
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, text, boolean
) SET search_path = public, extensions, pg_catalog;

-- 2. CLT document attachment RPC
ALTER FUNCTION public.attach_employee_self_registration_document(
  uuid, text, text, text, jsonb
) SET search_path = public, extensions, pg_catalog;

-- 3. PJ self registration function
ALTER FUNCTION public.create_professional_self_registration(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, date, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, numeric, integer, integer, date, boolean, text, boolean
) SET search_path = public, extensions, pg_catalog;

-- 4. PJ document attachment RPC
ALTER FUNCTION public.attach_professional_self_registration_document(
  uuid, text, text, text, jsonb
) SET search_path = public, extensions, pg_catalog;

-- 5. Employee time record registration functions (uses digest)
ALTER FUNCTION public.register_employee_time_record(
  uuid, text, text, jsonb, jsonb
) SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.register_employee_time_record_by_pin(
  uuid, text, text, jsonb, jsonb
) SET search_path = public, extensions, pg_catalog;
