-- ShopFlow store profile + logo storage setup
create table if not exists public.shopflow_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_name text not null check (char_length(store_name) between 1 and 80),
  store_url text not null default '',
  logo_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.shopflow_profiles enable row level security;

drop policy if exists "Users can read own ShopFlow profile" on public.shopflow_profiles;
create policy "Users can read own ShopFlow profile"
  on public.shopflow_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own ShopFlow profile" on public.shopflow_profiles;
create policy "Users can insert own ShopFlow profile"
  on public.shopflow_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own ShopFlow profile" on public.shopflow_profiles;
create policy "Users can update own ShopFlow profile"
  on public.shopflow_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.shopflow_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-logos', 'shop-logos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists "Public can view ShopFlow logos" on storage.objects;
create policy "Public can view ShopFlow logos"
  on storage.objects for select to public
  using (bucket_id = 'shop-logos');

drop policy if exists "Users can upload own ShopFlow logo" on storage.objects;
create policy "Users can upload own ShopFlow logo"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-logos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own ShopFlow logo" on storage.objects;
create policy "Users can update own ShopFlow logo"
  on storage.objects for update to authenticated
  using (bucket_id = 'shop-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'shop-logos' and (storage.foldername(name))[1] = auth.uid()::text);
