-- Issue #230 (for page #40 Ricerca): unaccent lets the search ignore accents («caffe»
-- finds «Caffè»). Only the extension in this migration (LEZIONI: extensions, then
-- types, then functions). Supabase keeps extensions in the dedicated "extensions"
-- schema, which the Data API does not expose.
-- The functions call it with the dictionary written in full
-- (extensions.unaccent('extensions.unaccent'::regdictionary, ...)): the one-argument
-- form looks the dictionary up through the search_path, which is empty in every
-- function of this project.
create extension if not exists unaccent with schema extensions;
