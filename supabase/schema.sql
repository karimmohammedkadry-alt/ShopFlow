-- ShopFlow: one-time 48-hour trial per authenticated account.
create table if not exists public.shopflow_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table public.shopflow_trials enable row level security;

-- Users may only read their own trial row. Writes happen through SECURITY DEFINER RPCs.
drop policy if exists "Users can read own ShopFlow trial" on public.shopflow_trials;
create policy "Users can read own ShopFlow trial"
  on public.shopflow_trials for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.start_my_trial()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare trial_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  insert into public.shopflow_trials(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;
  select started_at into trial_start
  from public.shopflow_trials
  where user_id = auth.uid();
  return trial_start;
end;
$$;

create or replace function public.get_my_trial()
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select json_build_object('started_at', started_at)
     from public.shopflow_trials where user_id = auth.uid()),
    'null'::json
  );
$$;

revoke all on function public.start_my_trial() from public;
revoke all on function public.get_my_trial() from public;
grant execute on function public.start_my_trial() to authenticated;
grant execute on function public.get_my_trial() to authenticated;
