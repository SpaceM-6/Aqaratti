-- ============================================================================
-- أدوات الذكاء الاصطناعي في «أنا عقار»: ذاكرة مؤقتة لملخصات المناطق، وكشف الصور المكررة بين الإعلانات.
-- يُشغَّل بعد portal.sql و filters.sql. آمن للتشغيل أكثر من مرة.
-- ============================================================================

-- ذاكرة مؤقتة لنتائج الذكاء الاصطناعي العامة (تكتبها الدالة الخلفية فقط)
create table if not exists public.ai_cache (
  key        text primary key,
  value      jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_cache enable row level security;
revoke all on public.ai_cache from anon, authenticated;

-- بصمة كل صورة (64 بت بصيغة hex) لكشف الصور المكررة أو المنسوخة من إعلانات أخرى
alter table public.properties add column if not exists image_hashes text[] not null default '{}';

create or replace function public.aq_hamming(a text, b text)
returns int
language sql
immutable
as $$
  select case when a ~ '^[0-9a-f]{16}$' and b ~ '^[0-9a-f]{16}$'
              then bit_count(('x' || a)::bit(64) # ('x' || b)::bit(64))::int
              else 64 end;
$$;

-- يبحث عن إعلانات أخرى فيها صور شبه مطابقة (فرق 6 بتات أو أقل من 64)
create or replace function public.find_duplicate_images(p_hashes text[], p_exclude bigint default null)
returns table (property_id bigint, title text, status text, same_owner boolean, distance int)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.status, (p.broker_id::text = coalesce(auth.uid()::text, '')),
         min(public.aq_hamming(h, x))
    from public.properties p
    cross join lateral unnest(p.image_hashes) x
    cross join lateral unnest(coalesce(p_hashes, '{}')) h
   where (p_exclude is null or p.id <> p_exclude)
     and p.status in ('approved', 'pending', 'paused')
     and public.aq_hamming(h, x) <= 6
   group by p.id, p.title, p.status, p.broker_id
   order by 5
   limit 10;
$$;
revoke all on function public.find_duplicate_images(text[], bigint) from public, anon;
grant execute on function public.find_duplicate_images(text[], bigint) to authenticated;
