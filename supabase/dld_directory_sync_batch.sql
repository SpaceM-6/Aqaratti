-- ============================================================================
-- مزامنة دليل الوسطاء مع سجل الدائرة على دفعات (2000 وسيط في كل مرة)
-- حتى لا تتجاوز مهلة التنفيذ في Supabase (8 ثوانٍ للطلب الواحد).
-- لوحة التحكم تستدعيها تلقائيًا دفعةً بعد دفعة. يُنفَّذ مرة واحدة من SQL Editor (آمن لو أُعيد).
-- ============================================================================
create or replace function public.aq_sync_directory_batch(p_offset integer, p_limit integer default 2000)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_upd integer; v_ins integer; v_n integer;
begin
  if not public.is_app_admin() then raise exception 'not allowed'; end if;
  create temporary table if not exists _aq_batch (like public.dld_brokers) on commit drop;
  truncate _aq_batch;
  insert into _aq_batch select * from public.dld_brokers order by broker_number offset p_offset limit p_limit;
  get diagnostics v_n = row_count;

  update public.individual_brokers ib set
      name_en             = coalesce(nullif(ib.name_en, ''), d.name_en),
      license_issue_date  = coalesce(d.license_start, ib.license_issue_date),
      license_expiry_date = coalesce(d.license_end, ib.license_expiry_date),
      office_number       = coalesce(d.office_number, ib.office_number),
      office_name_en      = coalesce(d.office_name, ib.office_name_en),
      office_name         = coalesce(nullif(ib.office_name, ''), d.office_name)
    from _aq_batch d
   where ib.dld_broker_number = d.broker_number
     and (ib.license_expiry_date is distinct from d.license_end or ib.office_number is distinct from d.office_number
          or coalesce(ib.name_en, '') = '' or ib.office_name_en is distinct from d.office_name);
  get diagnostics v_upd = row_count;

  insert into public.individual_brokers (dld_broker_number, name_en, office_name, office_name_en, office_number,
                                         license_issue_date, license_expiry_date, country, source, is_active)
  select d.broker_number, d.name_en, d.office_name, d.office_name, d.office_number,
         d.license_start, d.license_end, 'uae', 'dld_open_data', false
    from _aq_batch d
   where not exists (select 1 from public.individual_brokers ib where ib.dld_broker_number = d.broker_number)
  on conflict (dld_broker_number) do nothing;
  get diagnostics v_ins = row_count;

  return jsonb_build_object('processed', v_n, 'updated', v_upd, 'inserted', v_ins);
end;
$$;
grant execute on function public.aq_sync_directory_batch(integer, integer) to authenticated;
create index if not exists individual_brokers_dld_no_idx on public.individual_brokers (dld_broker_number);
