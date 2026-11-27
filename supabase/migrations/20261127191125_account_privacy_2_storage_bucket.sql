-- Issue #513 (DB-4 «Account e privacy», plan #501), part 2 of 2 (rule 12, CA-36): the
-- private bucket of the exports. Data only. Files of at most 50 MiB, only zip archives; never
-- public (the policies of storage.objects are in the account_privacy_2_policies_and_grants
-- migration). Idempotent: an existing bucket gets the same settings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('data-exports', 'data-exports', false, 52428800, array['application/zip'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
