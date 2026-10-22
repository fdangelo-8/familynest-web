-- An adult changes their own name and colour, then leaves (issue #9: CA-16).
-- B2 = Paolo, adult of Casa Bianchi, not admin.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ update public.household_members set name = 'Paolo B.', color = 'glicine'
     where id = 'b1000000-0000-4000-8000-000000000002' $$,
  'CA-16: B2 changes their own name and colour'
);
select results_eq(
  $$ select m.name, m.color::text from public.household_members m
     where m.id = 'b1000000-0000-4000-8000-000000000002' $$,
  $$ values ('Paolo B.', 'glicine') $$,
  'CA-16: new name and colour stored'
);
select throws_ok(
  $$ update public.household_members set color = 'cobalto'
     where id = 'b1000000-0000-4000-8000-000000000002' $$,
  '23505',
  null,
  'a colour already used in the household (Giulia, cobalto) is refused'
);
select throws_ok(
  $$ update public.household_members set birth_date = '1985-01-01'
     where id = 'b1000000-0000-4000-8000-000000000002' $$,
  '23514',
  null,
  'an adult cannot have a birth date'
);

-- B2 leaves the household: allowed, the household stays with Giulia as admin.
select results_eq(
  $$ delete from public.household_members where id = 'b1000000-0000-4000-8000-000000000002' returning name $$,
  $$ values ('Paolo B.') $$,
  'B2 leaves the household'
);
select is(
  public.current_household_id(),
  null,
  'after leaving, B2 has no household'
);

reset role;

select ok(
  exists (select 1 from public.households h where h.id = '22222222-2222-4222-8222-222222222222'),
  'Casa Bianchi still exists'
);
select is(
  (select m.name from public.household_members m
   where m.household_id = '22222222-2222-4222-8222-222222222222' and m.is_admin),
  'Giulia',
  'Giulia is still the only admin'
);

select * from finish();
rollback;
