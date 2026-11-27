-- Issue #513 (DB-4 «Account e privacy», plan #501), part 1 of 2 (CA-1–CA-11, plus the
-- appearance of A18 #551): the new enumerated types. Only types in this migration
-- (convenzioni-supabase); the tables and functions that use them come in the next
-- migrations.

-- The legal documents with a version (mn1-08, mn1-15):
--   terms    «Termini di servizio»
--   privacy  «Informativa sulla privacy»
create type public.legal_document as enum ('terms', 'privacy');

-- What an adult agrees to (mn1-10, mn1-11, mn1-12). The first two are required to use the
-- app and are taken back only by deleting the account; the other three are optional and
-- off until the adult switches them on.
--   terms_and_privacy    «Ho letto e accetto i termini e l'informativa» (required)
--   adult                «Ho almeno 18 anni» (required)
--   product_news_email   «Novità dell'app per mail» (optional, off)
--   usage_analytics      «Aiutaci a migliorare» (optional, off)
--   assistant_questions  «Domande all'assistente» (optional, off)
create type public.consent_kind as enum (
  'terms_and_privacy',
  'adult',
  'product_news_email',
  'usage_analytics',
  'assistant_questions'
);

-- Where a consent was given or changed:
--   signup     «Crea account» (also the first opening after Apple or Google)
--   settings   «Consensi» (mn1-10)
--   first_use  «Prima di fare domande» (mn1-11)
--   update     «L'informativa è cambiata» (mn1-15): new version read
create type public.consent_source as enum ('signup', 'settings', 'first_use', 'update');

-- «Dove sei entrato» (mn1-09): the kind of device of a session, read from its user agent.
create type public.session_device as enum ('phone', 'tablet', 'computer', 'unknown');

-- «Aspetto» (A18 #551, §4): «Chiaro», «Scuro», «Come il telefono». The page puts it on the
-- `html` as `data-aspetto` (chiaro, scuro, sistema).
create type public.appearance_mode as enum ('light', 'dark', 'system');
