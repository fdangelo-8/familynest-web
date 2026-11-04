-- Issue #218 (for page #38 «Il tuo profilo»): the lens with which Oggi and the other
-- pages with a lens open at the first visit of a browser session («All'apertura»).
-- Same values as the type Lens of the app (src/lib/lens.ts):
--   io    «Io»    default
--   nest  «Nest»
create type public.lens as enum ('io', 'nest');
