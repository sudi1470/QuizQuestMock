insert into public.categories (name, icon)
values
  ('Movies', 'clapperboard'),
  ('Science', 'flask-conical'),
  ('History', 'landmark'),
  ('Crypto', 'bitcoin'),
  ('Geography', 'globe')
on conflict (name) do nothing;
