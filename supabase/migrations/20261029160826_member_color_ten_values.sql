-- Issue #74 (part 3): up to 10 members per household, each with a colour of their own,
-- so member_color goes from 5 to 10 values. The 5 existing values keep their names and
-- order; the 5 new ones (chosen by the designer, same names as the design system tokens
-- --color-membro-*) are appended in this order.
-- Only this statement in this migration: a value added with ADD VALUE cannot be used
-- in the same transaction (LEZIONI).
alter type public.member_color add value 'lampone';
alter type public.member_color add value 'ceruleo';
alter type public.member_color add value 'peonia';
alter type public.member_color add value 'basilico';
alter type public.member_color add value 'cannella';
