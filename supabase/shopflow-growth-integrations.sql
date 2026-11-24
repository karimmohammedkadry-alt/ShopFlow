-- ShopFlow growth, website publishing, team permissions and first-party analytics
create extension if not exists pgcrypto;

-- Marketing: coupons and campaign drafts
create table if not exists public.shopflow_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order numeric(12,2) not null default 0 check (min_order >= 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, code),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);
create index if not exists shopflow_coupons_user_idx on public.shopflow_coupons(user_id, created_at desc);

create table if not exists public.shopflow_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('email','whatsapp','social')),
  message text not null default '',
  status text not null default 'draft' check (status in ('draft','scheduled','sent','failed')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Extend team records to map invitations to authenticated accounts and permissions
alter table public.shopflow_team_members add column if not exists member_user_id uuid references auth.users(id) on delete set null;
alter table public.shopflow_team_members add column if not exists permissions text[] not null default array['products','orders','customers']::text[];
alter table public.shopflow_team_members add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.shopflow_team_members add column if not exists accepted_at timestamptz;

-- Storefront publishing: existing shopflow_pages table is used.
create index if not exists shopflow_pages_public_idx on public.shopflow_pages(user_id, slug) where is_published = true;

-- First-party analytics for independently programmed sites.
create table if not exists public.shopflow_tracking_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  public_token text not null unique default encode(gen_random_bytes(24),'hex'),
  allowed_origins text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shopflow_analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in ('page_view','session_start','add_to_cart','begin_checkout','purchase','lead','custom')),
  visitor_id text not null,
  session_id text not null,
  page_url text not null default '',
  page_path text not null default '',
  referrer text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  event_value numeric(12,2),
  currency text not null default 'EGP',
  created_at timestamptz not null default now()
);
create index if not exists shopflow_analytics_events_user_time_idx on public.shopflow_analytics_events(user_id, created_at desc);
create index if not exists shopflow_analytics_events_user_visitor_idx on public.shopflow_analytics_events(user_id, visitor_id, created_at desc);

-- Central permission check used by row-level security.
create or replace function public.shopflow_has_permission(p_owner uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() = p_owner or exists (
    select 1 from public.shopflow_team_members m
    where m.owner_id = p_owner and m.member_user_id = auth.uid()
      and m.invite_status = 'accepted'
      and (m.role = 'manager' or p_permission = any(m.permissions))
  );
$$;
revoke all on function public.shopflow_has_permission(uuid,text) from public;
grant execute on function public.shopflow_has_permission(uuid,text) to authenticated;

-- Rebuild owner-only policies as permission-aware policies.
drop policy if exists "ShopFlow products owner access" on public.shopflow_products;
drop policy if exists "ShopFlow products team access" on public.shopflow_products;
create policy "ShopFlow products team access" on public.shopflow_products for all to authenticated
using (public.shopflow_has_permission(user_id,'products'))
with check (public.shopflow_has_permission(user_id,'products'));

drop policy if exists "ShopFlow customers owner access" on public.shopflow_customers;
drop policy if exists "ShopFlow customers team access" on public.shopflow_customers;
create policy "ShopFlow customers team access" on public.shopflow_customers for all to authenticated
using (public.shopflow_has_permission(user_id,'customers'))
with check (public.shopflow_has_permission(user_id,'customers'));

drop policy if exists "ShopFlow orders owner access" on public.shopflow_orders;
drop policy if exists "ShopFlow orders team access" on public.shopflow_orders;
create policy "ShopFlow orders team access" on public.shopflow_orders for all to authenticated
using (public.shopflow_has_permission(user_id,'orders'))
with check (public.shopflow_has_permission(user_id,'orders'));

drop policy if exists "ShopFlow appointments owner access" on public.shopflow_appointments;
drop policy if exists "ShopFlow appointments team access" on public.shopflow_appointments;
create policy "ShopFlow appointments team access" on public.shopflow_appointments for all to authenticated
using (public.shopflow_has_permission(user_id,'appointments'))
with check (public.shopflow_has_permission(user_id,'appointments'));

drop policy if exists "ShopFlow team owner access" on public.shopflow_team_members;
drop policy if exists "ShopFlow team owner select" on public.shopflow_team_members;
create policy "ShopFlow team owner select" on public.shopflow_team_members for select to authenticated
using (auth.uid() = owner_id or auth.uid() = member_user_id);
create policy "ShopFlow team owner manage" on public.shopflow_team_members for all to authenticated
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table public.shopflow_coupons enable row level security;
alter table public.shopflow_campaigns enable row level security;
alter table public.shopflow_tracking_sites enable row level security;
alter table public.shopflow_analytics_events enable row level security;

drop policy if exists "ShopFlow coupons owner access" on public.shopflow_coupons;
create policy "ShopFlow coupons owner access" on public.shopflow_coupons for all to authenticated
using (public.shopflow_has_permission(user_id,'marketing'))
with check (public.shopflow_has_permission(user_id,'marketing'));
drop policy if exists "ShopFlow campaigns owner access" on public.shopflow_campaigns;
create policy "ShopFlow campaigns owner access" on public.shopflow_campaigns for all to authenticated
using (public.shopflow_has_permission(user_id,'marketing'))
with check (public.shopflow_has_permission(user_id,'marketing'));
drop policy if exists "ShopFlow tracking site owner access" on public.shopflow_tracking_sites;
create policy "ShopFlow tracking site owner access" on public.shopflow_tracking_sites for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ShopFlow analytics events owner read" on public.shopflow_analytics_events;
create policy "ShopFlow analytics events owner read" on public.shopflow_analytics_events for select to authenticated
using (auth.uid() = user_id);

grant select,insert,update,delete on public.shopflow_coupons to authenticated;
grant select,insert,update,delete on public.shopflow_campaigns to authenticated;
grant select,insert,update,delete on public.shopflow_tracking_sites to authenticated;
grant select on public.shopflow_analytics_events to authenticated;


create or replace function public.shopflow_get_analytics_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security invoker set search_path = public
as $$
  with filtered as (
    select * from public.shopflow_analytics_events
    where user_id = auth.uid() and created_at >= p_from and created_at < p_to
  ),
  totals as (
    select
      count(*) filter (where event_name='page_view') as page_views,
      count(distinct visitor_id) as visitors,
      count(distinct session_id) as sessions,
      count(*) filter (where event_name='purchase') as purchases,
      coalesce(sum(event_value) filter (where event_name='purchase'),0) as tracked_revenue
    from filtered
  ),
  sources as (
    select coalesce(nullif(utm_source,''),'direct') as source, count(distinct session_id) as sessions
    from filtered group by 1 order by sessions desc limit 8
  ),
  pages as (
    select page_path, count(*) as views
    from filtered where event_name='page_view'
    group by page_path order by views desc limit 8
  )
  select jsonb_build_object(
    'page_views', totals.page_views, 'visitors', totals.visitors,
    'sessions', totals.sessions, 'purchases', totals.purchases,
    'tracked_revenue', totals.tracked_revenue,
    'sources', coalesce((select jsonb_agg(to_jsonb(sources)) from sources),'[]'::jsonb),
    'pages', coalesce((select jsonb_agg(to_jsonb(pages)) from pages),'[]'::jsonb)
  ) from totals;
$$;
grant execute on function public.shopflow_get_analytics_summary(timestamptz,timestamptz) to authenticated;
