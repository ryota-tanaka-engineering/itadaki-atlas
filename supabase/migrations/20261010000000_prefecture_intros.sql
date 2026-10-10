-- =============================================================================
-- prefecture_intros — 都道府県の総論（一行文脈）と読み物（地の文）
-- =============================================================================
-- 背景: 体験原則2「選択の直後に必ず文脈を出す」の県ページ側の未充足（2026-09 から
-- 県には DB の総論が無く、件数と一覧だけだった）。ユーザー選択 2026-10-04「47県の一行
-- ＋石川の地の文」（ロードマップ P2-3 の読み物化の初手）。
--
-- 方針:
-- - place_names と同じ二層方式: 都道府県（日本語名＝food_items.origin_pref と同じ表記）×
--   locale の行で持つ。zh-Hant/ko は行追加だけで増やせる
-- - intro（一行の総論）は必須。body_md（地の文、Markdown）は旗艦の県だけ任意
-- - 出典は prefecture_intro_sources に内部検証データとして持つ（UI 非表示。food_item_sources と同じ）
-- - 書き込みは service_role のみ（scripts/import-prefecture-intros.ts）
-- =============================================================================

create table if not exists public.prefecture_intros (
  pref       text not null,
  locale     text not null check (locale in ('ja', 'en', 'zh-Hant', 'ko')),
  intro      text not null check (length(intro) between 1 and 600),
  body_md    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (pref, locale)
);

comment on table public.prefecture_intros is
  '都道府県の総論（intro: 一行の文脈、県ページ冒頭とトップの県絞り込みに出す）と読み物（body_md: 地の文。旗艦の県のみ）。'
  'pref は日本語の正式名（food_items.origin_pref と同じ表記）';

create table if not exists public.prefecture_intro_sources (
  id          uuid primary key default gen_random_uuid(),
  pref        text not null,
  title       text not null,
  url         text,
  publisher   text,
  accessed_at date,
  created_at  timestamptz not null default now()
);

comment on table public.prefecture_intro_sources is
  '県の総論・読み物の出典。内部の検証データで UI には出さない（food_item_sources と同じ方針）';

create index if not exists prefecture_intro_sources_pref_idx on public.prefecture_intro_sources (pref);

drop trigger if exists set_updated_at on public.prefecture_intros;
create trigger set_updated_at before update on public.prefecture_intros
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + GRANT（place_names と同じ。出典は anon から読めないようにする）
-- -----------------------------------------------------------------------------
grant select on public.prefecture_intros to anon, authenticated;
grant select, insert, update, delete on public.prefecture_intros to service_role;
grant select, insert, update, delete on public.prefecture_intro_sources to service_role;

alter table public.prefecture_intros enable row level security;
alter table public.prefecture_intro_sources enable row level security;

drop policy if exists prefecture_intros_select_all on public.prefecture_intros;
create policy prefecture_intros_select_all on public.prefecture_intros
  for select using (true);

-- prefecture_intro_sources には select ポリシーを作らない（anon からは全拒否。service_role のみ）。
