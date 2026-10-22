-- Data: profiles for accounts created before the on_auth_user_created trigger existed.
-- Same name rule as public.handle_new_user(); no email is copied. Idempotent.
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(
    btrim(
      left(
        btrim(
          coalesce(
            u.raw_user_meta_data ->> 'full_name',
            u.raw_user_meta_data ->> 'name',
            u.raw_user_meta_data ->> 'display_name'
          ),
          E' \t\r\n'
        ),
        100
      ),
      E' \t\r\n'
    ),
    ''
  )
from auth.users u
on conflict (id) do nothing;
