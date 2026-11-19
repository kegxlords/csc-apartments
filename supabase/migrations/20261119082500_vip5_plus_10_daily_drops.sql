begin;

-- Per-product cadence and purchase-time snapshots keep catalog changes from
-- changing the payout terms of leases that already exist.
alter table public.units
  add column if not exists income_drop_days text;

alter table public.leases
  add column if not exists unit_price numeric(15,2),
  add column if not exists daily_yield numeric(15,2),
  add column if not exists duration_days int,
  add column if not exists income_drop_days text;

-- Preserve each current lease's package terms before changing any product rows.
update public.leases as l
set unit_price = coalesce(l.unit_price, u.price),
    daily_yield = coalesce(l.daily_yield, u.daily_yield),
    duration_days = coalesce(l.duration_days, u.duration_days),
    income_drop_days = coalesce(
      l.income_drop_days,
      u.income_drop_days,
      (select s.value from public.settings as s where s.key = 'income_drop_days'),
      '1,2,3,4,5'
    )
from public.units as u
where u.id = l.unit_id;

alter table public.leases alter column unit_price set not null;
alter table public.leases alter column daily_yield set not null;
alter table public.leases alter column duration_days set not null;
alter table public.leases alter column income_drop_days set not null;

create or replace function public.snapshot_lease_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.units%rowtype;
  v_days text;
begin
  select * into u from public.units where id = new.unit_id;
  if not found then raise exception 'Package not found.'; end if;
  select value into v_days from public.settings where key = 'income_drop_days';

  new.unit_price := u.price;
  new.daily_yield := u.daily_yield;
  new.duration_days := u.duration_days;
  new.income_drop_days := coalesce(u.income_drop_days, v_days, '1,2,3,4,5');
  return new;
end $$;

drop trigger if exists snapshot_lease_terms on public.leases;
create trigger snapshot_lease_terms
before insert on public.leases
for each row execute function public.snapshot_lease_terms();

create or replace function public.vip_package_rank(p_label text)
returns int language sql immutable parallel safe as $$
  select substring(coalesce(p_label, '') from '(?i)VIP[[:space:]_-]*([0-9]+)')::int
$$;

create or replace function public.enforce_vip5_package_terms()
returns trigger language plpgsql set search_path = public as $$
declare v_rank int;
begin
  v_rank := greatest(
    coalesce(public.vip_package_rank(new.tier), 0),
    coalesce(public.vip_package_rank(new.name), 0)
  );
  if v_rank >= 5 then
    new.daily_yield := round(new.price * 0.20, 2);
    new.duration_days := 10;
    new.income_drop_days := '0,1,2,3,4,5,6';
  end if;
  return new;
end $$;

drop trigger if exists enforce_vip5_package_terms on public.units;
create trigger enforce_vip5_package_terms before insert or update on public.units
for each row execute function public.enforce_vip5_package_terms();

-- Match existing packages whose name or tier identifies VIP 5 or higher.
-- These terms affect new purchases only; existing leases now use their snapshots.
do $$
declare
  v_updated int;
begin
  with ranked as (
    select id, price,
      substring(coalesce(tier, '') from '(?i)VIP[[:space:]_-]*([0-9]+)')::int as tier_rank,
      substring(coalesce(name, '') from '(?i)VIP[[:space:]_-]*([0-9]+)')::int as name_rank
    from public.units
  )
  update public.units as u
  set duration_days = 10,
      daily_yield = round(r.price * 0.20, 2),
      income_drop_days = '0,1,2,3,4,5,6'
  from ranked as r
  where u.id = r.id
    and greatest(coalesce(r.tier_rank, 0), coalesce(r.name_rank, 0)) >= 5;

  get diagnostics v_updated = row_count;
  raise notice 'Updated % existing VIP 5+ package(s) for future purchases.', v_updated;
end $$;

-- Income sweeps now use the terms captured on each lease, not the live catalog.
create or replace function public.sweep_income(p_limit int default 250)
returns table (scanned int, drops_paid int, amount_paid numeric, leases_completed int, remaining int)
language plpgsql security definer set search_path = public as $$
declare
  l record; v_due int; v_target int; v_paid int := 0; v_amt numeric := 0;
  v_done int := 0; v_scan int := 0; v_ref text;
begin
  for l in
    select ls.id, ls.user_id, ls.days_paid, ls.started_at,
           ls.daily_yield, ls.duration_days, ls.income_drop_days, u.name
    from public.leases as ls
    join public.units as u on u.id = ls.unit_id
    where ls.status = 'active'
    order by ls.started_at
    limit p_limit
    for update of ls skip locked
  loop
    v_scan := v_scan + 1;
    v_due := floor(extract(epoch from (now() - l.started_at)) / 86400);
    select count(*)::int into v_target
      from generate_series(1, greatest(v_due, 0)) as day_offset
      where position(',' || extract(dow from (l.started_at + (day_offset || ' days')::interval))::int || ','
                     in ',' || l.income_drop_days || ',') > 0;
    v_target := least(v_target, l.duration_days);

    while l.days_paid < v_target loop
      l.days_paid := l.days_paid + 1;
      v_ref := 'INC-' || substr(replace(l.id::text,'-',''),1,8) || '-' || l.days_paid;
      if exists (select 1 from public.transactions where reference = v_ref) then continue; end if;

      insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status,created_at)
      values (l.user_id,'rental_income',l.daily_yield,0,l.daily_yield,
              l.name||' · drop '||l.days_paid, v_ref,'completed',
              l.started_at + (l.days_paid || ' days')::interval);

      update public.wallets set balance = balance + l.daily_yield,
                               income_balance = income_balance + l.daily_yield,
                               updated_at = now() where user_id = l.user_id;
      update public.leases set days_paid = l.days_paid,
                              total_collected = total_collected + l.daily_yield where id = l.id;
      v_paid := v_paid + 1; v_amt := v_amt + l.daily_yield;
    end loop;

    if l.days_paid >= l.duration_days then
      update public.leases set status = 'completed' where id = l.id;
      v_done := v_done + 1;
    end if;
  end loop;

  select count(*) into remaining
  from public.leases as ls
  where ls.status = 'active'
    and (
      select count(*)::int
      from generate_series(
        1,
        greatest(floor(extract(epoch from (now() - ls.started_at)) / 86400)::int, 0)
      ) as day_offset
      where position(',' || extract(dow from (ls.started_at + (day_offset || ' days')::interval))::int || ','
                     in ',' || ls.income_drop_days || ',') > 0
    ) > ls.days_paid;

  return query select v_scan, v_paid, v_amt, v_done, remaining;
end $$;

commit;
