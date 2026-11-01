-- ============================================================================
-- إخفاء الإعلانات التي لم يؤكد صاحبها توافرها خلال 60 يومًا (إخفاء فقط، لا حذف أبدًا)
--   • اليوم 50: تنبيه للوسيط داخل حسابه (وعلى جواله إن فعّل الإشعارات): «أكّد توافر العقار خلال 10 أيام»
--   • اليوم 60: يُخفى الإعلان عن الزوار (الحالة expired) ويُحفظ كما هو بصوره وبياناته، مع تنبيه ثانٍ
--   • يضغط الوسيط «ما زال متاحًا» فيعود الإعلان للظهور فورًا دون مراجعة جديدة
-- العدّ من آخر تأكيد للتوافر (أو من تاريخ الاعتماد إن لم يؤكد بعد).
-- يُنفَّذ مرة واحدة من Supabase → SQL Editor (آمن لو أُعيد تشغيله). يعتمد على trust_market.sql وengagement.sql.
-- ============================================================================
alter table public.properties add column if not exists stale_warned_at timestamptz;
alter table public.properties add column if not exists expired_at timestamptz;

create or replace function public.aq_expire_stale_listings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_warned integer := 0; v_hidden integer := 0; r record;
begin
  -- 1) تنبيه قبل الإخفاء بعشرة أيام (مرة واحدة لكل فترة)
  for r in
    select id, broker_id, title from public.properties
     where status = 'approved' and broker_id is not null
       and coalesce(available_at, reviewed_at, created_at) < now() - interval '50 days'
       and coalesce(available_at, reviewed_at, created_at) >= now() - interval '60 days'
       and (stale_warned_at is null or stale_warned_at < coalesce(available_at, reviewed_at, created_at))
  loop
    insert into public.user_notifications (user_id, kind, title, body, url)
    values (r.broker_id, 'listing_stale', 'أكّد أن عقارك ما زال متاحًا',
            'إعلان «' || left(r.title, 80) || '» لم يُؤكَّد توافره منذ 50 يومًا. اضغط «ما زال متاحًا» خلال 10 أيام وإلا سيُخفى عن الزوار مؤقتًا (لن يُحذف).',
            '/pro.html#listings');
    update public.properties set stale_warned_at = now() where id = r.id;
    v_warned := v_warned + 1;
  end loop;

  -- 2) الإخفاء بعد 60 يومًا (يبقى الإعلان محفوظًا بكل بياناته)
  for r in
    select id, broker_id, title from public.properties
     where status = 'approved' and broker_id is not null
       and coalesce(available_at, reviewed_at, created_at) < now() - interval '60 days'
  loop
    update public.properties set status = 'expired', expired_at = now() where id = r.id;
    insert into public.user_notifications (user_id, kind, title, body, url)
    values (r.broker_id, 'listing_expired', 'أُخفي إعلانك مؤقتًا',
            'أُخفي إعلان «' || left(r.title, 80) || '» عن الزوار لأنه لم يُؤكَّد توافره منذ 60 يومًا. الإعلان محفوظ كما هو، واضغط «ما زال متاحًا» ليعود فورًا.',
            '/pro.html#listings');
    v_hidden := v_hidden + 1;
  end loop;
  return jsonb_build_object('warned', v_warned, 'hidden', v_hidden);
end;
$$;
-- آمنة للاستدعاء من أي جهة: لا تقبل مدخلات، وتطبّق القاعدة نفسها فقط.
-- يستدعيها GitHub Actions كل 20 دقيقة (share-pages.yml)، ويمكن جدولتها أيضًا بـ pg_cron أدناه.
grant execute on function public.aq_expire_stale_listings() to anon, authenticated;

-- «ما زال متاحًا»: يؤكد التوافر، ويعيد الإعلان المخفي للظهور فورًا
create or replace function public.confirm_property_available(p_id public.aq_prop_id)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select broker_id into v_owner from public.properties where id = p_id;
  if v_owner is null then raise exception 'not found'; end if;
  if not (v_owner = auth.uid() or public.is_app_admin()) then raise exception 'not allowed'; end if;
  update public.properties
     set available_at = now(), stale_warned_at = null, expired_at = null,
         status = case when status = 'expired' then 'approved' else status end
   where id = p_id;
  return now();
end;
$$;
revoke all on function public.confirm_property_available(public.aq_prop_id) from public, anon;
grant execute on function public.confirm_property_available(public.aq_prop_id) to authenticated;

-- جدولة يومية داخل قاعدة البيانات إن كان pg_cron مفعّلًا (وإلا يكفي تشغيل GitHub Actions)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'aq-expire-stale';
    perform cron.schedule('aq-expire-stale', '15 6 * * *', 'select public.aq_expire_stale_listings()');
  end if;
exception when others then null;
end $$;
