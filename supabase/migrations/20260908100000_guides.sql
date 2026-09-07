-- =============================================================================
-- 「食べに行く前に」ガイド（マナー・注文攻略・支払い等の実用ページ）
-- =============================================================================
-- 定義: 作業パッケージ「食べに行く前にガイド」
-- 方針:
-- - 最初から多言語前提。列に _ja/_en を付けず guide_translations に翻訳行を持つ
--   （food_item_translations と同じ二層方式。.doc/20_data/01_models.md §1.3）
-- - guide_links は genres/shelves/tags への疎な参照（FK制約なし）。
--   chains.genre_slug と同じ方針で、参照先が未投入でも投入できる状態を保つ
-- - 既存パターン踏襲（IF NOT EXISTS / DROP POLICY IF EXISTS / 冪等）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. guides — ガイドマスタ
-- -----------------------------------------------------------------------------
create table if not exists public.guides (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  kind       text not null check (kind in ('ordering', 'paying', 'manners', 'finding', 'takeaway', 'seasons')),
  sort_order integer not null default 0,
  status     text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint guides_slug_format check (slug ~ '^[a-z0-9-]+$')
);

comment on table public.guides is
  '「食べに行く前に」ガイド（マナー・注文攻略・支払い等）。断定せず「〜なことが多い」「店による」の文体（ia-atlas-content Skill）';
comment on column public.guides.kind is
  '注文(ordering) / 支払い(paying) / マナー(manners) / 店の見つけ方(finding) / 持ち帰り・土産(takeaway) / 季節・時間(seasons)';

-- -----------------------------------------------------------------------------
-- 2. guide_translations — 自由記述の翻訳（言語追加＝行追加）
-- -----------------------------------------------------------------------------
create table if not exists public.guide_translations (
  guide_id   uuid not null references public.guides (id) on delete cascade,
  locale     text not null check (locale in ('ja', 'en', 'zh-Hant', 'ko')),
  title      text not null,
  summary    text,
  body_md    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (guide_id, locale)
);

comment on table public.guide_translations is
  '自由記述の翻訳。マスタラベルはDBでなくアプリのi18n辞書ファイルで持つ（food_item_translations と同じ二層方式）';

-- -----------------------------------------------------------------------------
-- 3. guide_sources — 出典（内部検証用。UI非表示。food_item_sources と同じ方針）
-- -----------------------------------------------------------------------------
create table if not exists public.guide_sources (
  id          uuid primary key default gen_random_uuid(),
  guide_id    uuid not null references public.guides (id) on delete cascade,
  title       text not null,
  url         text,
  publisher   text,
  accessed_at date,
  created_at  timestamptz not null default now()
);

comment on table public.guide_sources is
  '参照するのは事実のみ。文章表現は必ず書き直す（転載禁止。.doc/40_operation/01_strategy.md §1.2）。UIには出さない';

-- -----------------------------------------------------------------------------
-- 4. guide_links — ガイド → 食べもの（genre/shelf/tag への疎な参照）
-- -----------------------------------------------------------------------------
create table if not exists public.guide_links (
  guide_id    uuid not null references public.guides (id) on delete cascade,
  target_kind text not null check (target_kind in ('genre', 'shelf', 'tag')),
  target_slug text not null,
  created_at  timestamptz not null default now(),

  primary key (guide_id, target_kind, target_slug)
);

comment on table public.guide_links is
  'ガイドを食べものへ結びつける（例:「ラーメン屋は現金が多い」→ genre ramen）。'
  'genres/shelves/tags への疎な参照（FK制約なし。chains.genre_slug と同じ方針）。'
  '詳細ページ「食べに行く前に」節（逆引き: アイテムの genre/shelf/tags から一致するガイドを探す）にも使う';

-- -----------------------------------------------------------------------------
-- 5. インデックス
-- -----------------------------------------------------------------------------
create index if not exists guides_kind_idx on public.guides (kind);
create index if not exists guides_status_idx on public.guides (status);
create index if not exists guide_translations_guide_id_idx on public.guide_translations (guide_id);
create index if not exists guide_sources_guide_id_idx on public.guide_sources (guide_id);
create index if not exists guide_links_guide_id_idx on public.guide_links (guide_id);
-- 詳細ページ「食べに行く前に」節の逆引き（target_kind, target_slug → guide_id）用
create index if not exists guide_links_target_idx on public.guide_links (target_kind, target_slug);

-- -----------------------------------------------------------------------------
-- 6. updated_at 自動更新（public.set_updated_at は init migration で定義済み）
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['guides', 'guide_translations'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- =============================================================================
-- 7. RLS + GRANT（init migration と同一パターン。書き込みは service_role のみ）
-- =============================================================================
grant select on
  public.guides,
  public.guide_translations,
  public.guide_sources,
  public.guide_links
to anon, authenticated;

grant select, insert, update, delete on
  public.guides,
  public.guide_translations,
  public.guide_sources,
  public.guide_links
to service_role;

alter table public.guides              enable row level security;
alter table public.guide_translations  enable row level security;
alter table public.guide_sources       enable row level security;
alter table public.guide_links         enable row level security;

-- guides: published のみ（food_items と同じ方針）
drop policy if exists guides_select_published on public.guides;
create policy guides_select_published on public.guides
  for select using (status = 'published');

-- 子テーブル: 親の status を辿って判定する
drop policy if exists guide_translations_select_published on public.guide_translations;
create policy guide_translations_select_published on public.guide_translations
  for select using (
    exists (select 1 from public.guides g
             where g.id = guide_id and g.status = 'published')
  );

drop policy if exists guide_sources_select_published on public.guide_sources;
create policy guide_sources_select_published on public.guide_sources
  for select using (
    exists (select 1 from public.guides g
             where g.id = guide_id and g.status = 'published')
  );

drop policy if exists guide_links_select_published on public.guide_links;
create policy guide_links_select_published on public.guide_links
  for select using (
    exists (select 1 from public.guides g
             where g.id = guide_id and g.status = 'published')
  );

-- insert / update / delete のポリシーは作らない。
-- RLS有効かつポリシー不在 = 全拒否。service_role のみが書き込める。
