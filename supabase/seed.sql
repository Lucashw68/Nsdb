-- Stable, local-only playground identities. Integration tests continue to create
-- isolated users through the public Auth API.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'alice+playground@example.test',
    crypt('NSDB-playground-alice', gen_salt('bf')),
    now(),
	'',
	'',
	'',
	'',
    '{"provider":"email","providers":["email"]}',
	'{"sub":"10000000-0000-0000-0000-000000000001","email":"alice+playground@example.test","email_verified":true,"phone_verified":false}',
    now(),
    now(),
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'bob+playground@example.test',
    crypt('NSDB-playground-bob', gen_salt('bf')),
    now(),
	'',
	'',
	'',
	'',
    '{"provider":"email","providers":["email"]}',
	'{"sub":"10000000-0000-0000-0000-000000000002","email":"bob+playground@example.test","email_verified":true,"phone_verified":false}',
    now(),
    now(),
    false,
    false
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '{"sub":"10000000-0000-0000-0000-000000000001","email":"alice+playground@example.test","email_verified":true,"phone_verified":false}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '{"sub":"10000000-0000-0000-0000-000000000002","email":"bob+playground@example.test","email_verified":true,"phone_verified":false}',
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, user_id, display_name)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alice'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Bob')
on conflict (id) do nothing;

insert into public.playlists (id, user_id, title, description, status)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alice favourites', 'Visible only to Alice through RLS.', 'published'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Alice drafts', 'A deterministic draft for CRUD demos.', 'draft'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Bob favourites', 'Visible only to Bob through RLS.', 'published'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Bob drafts', 'A deterministic draft for CRUD demos.', 'draft')
on conflict (id) do nothing;

insert into public.component_records (id, user_id, title, notes, priority, published, status)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alice component row', 'Seeded for NsdbList and NsdbForm.', 1, true, 'published'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Bob component row', 'Seeded for NsdbList and NsdbForm.', 2, false, 'draft')
on conflict (id) do nothing;
