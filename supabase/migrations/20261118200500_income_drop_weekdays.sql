insert into public.settings (key, value)
values ('income_drop_days', '1,2,3,4,5')
on conflict (key) do nothing;

create or replace function public.sweep_income(p_limit int default 250)
returns table (scanned int, drops_paid int, amount_paid numeric, leases_completed int, remaining int)
language plpgsql security definer set search_path = public as $$
declare
  l record; v_due int; v_target int; v_paid int := 0; v_amt numeric := 0;
  v_income_days text;
  v_done int := 0; v_scan int := 0; v_ref text;
begin
  select coalesce(value,'1,2,3,4,5') into v_income_days from public.settings where key='income_drop_days';
  for l in
    select ls.id, ls.user_id, ls.days_paid, ls.started_at,
           u.daily_yield, u.duration_days, u.name
    from public.leases ls join public.units u on u.id = ls.unit_id
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
                     in ',' || v_income_days || ',') > 0;
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
      update public.leases set status='completed' where id = l.id;
      v_done := v_done + 1;
    end if;
  end loop;

  select count(*) into remaining from public.leases
    where status='active' and floor(extract(epoch from (now() - started_at))/86400) > days_paid;

  return query select v_scan, v_paid, v_amt, v_done, remaining;
end $$;
