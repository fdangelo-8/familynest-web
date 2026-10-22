-- Extensions used by the base schema (issue #9).
-- pgcrypto provides gen_random_bytes() for invitation secrets (>= 128 bits of randomness).
-- Supabase keeps extensions in the dedicated "extensions" schema.
create extension if not exists pgcrypto with schema extensions;
