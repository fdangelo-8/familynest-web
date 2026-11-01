-- Issue #187 (for pages #28 Esplora, #29 «In arrivo», #30 Oggi): the 10 spaces of the
-- Esplora catalogue, in the order of the catalogue (issue #28, §4). The catalogue itself
-- (names, texts, icons, addresses) lives in the app code (src/lib/spaces.ts); the
-- database only knows the keys.
--   meals     «A tavola»        always available
--   couple    «Noi due»         at least 2 adults
--   wellbeing «Stare bene»      always available
--   together  «Tempo insieme»   always available
--   hobbies   «Passioni»        always available
--   chores    «Casa in ordine»  always available
--   projects  «Progetti»        always available
--   expenses  «Conti chiari»    at least 2 adults
--   children  «Crescere»        at least 1 child
--   pets      «Zampe»           at least 1 pet
-- Availability is computed by private.space_is_available() (functions migration).
create type public.space_key as enum (
  'meals',
  'couple',
  'wellbeing',
  'together',
  'hobbies',
  'chores',
  'projects',
  'expenses',
  'children',
  'pets'
);
