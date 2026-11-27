-- Issue #513 (DB-4 «Account e privacy», plan #501), part 2 of 2: the new values of
-- notification_kind. Only `alter type ... add value` in this migration (CA-34, LEZIONI): a
-- value added with ADD VALUE cannot be used in the transaction that adds it, so the
-- constraint, the functions and the triggers that use them come in the next migrations.
--
--   household_handed_over  «Laura ha ricevuto un avviso» (cb1-51): the only organiser asked
--                          to delete the account and the heir now organises the household
--                          (actor = who asked)
--   data_export_ready      «La tua copia è pronta» (cb1-48): the export of the recipient's
--                          own data can be downloaded for 24 hours (no actor)
alter type public.notification_kind add value if not exists 'household_handed_over';
alter type public.notification_kind add value if not exists 'data_export_ready';
