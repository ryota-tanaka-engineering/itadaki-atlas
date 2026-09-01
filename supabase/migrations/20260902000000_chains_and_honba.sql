-- =============================================================================
-- チェーン橋渡し + 本場（食の地域リレーション拡張）+ ジャンル総論
-- =============================================================================
-- 定義: 作業パッケージ「チェーン橋渡し・本場機構」
--   1. チェーン橋渡し: 全国チェーンを入口に「系統・ご当地」へ渡す（North Star 広く軸）
--   2. 本場機構: 発祥・名産地に次ぐ第3の型（「どこでも食べられるが、ここのは特別」）
-- 方針: 既存パターン踏襲（IF NOT EXISTS / DROP POLICY IF EXISTS / 冪等）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. chains — 全国チェーンマスタ
-- -----------------------------------------------------------------------------
create table if not exists public.chains (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name_ja      text not null,
  name_en      text not null,
  style_ja     text,
  style_en     text,
  founded_note text,
  bridge_ja    text not null,
  bridge_en    text not null,
  genre_slug   text not null,
  pref_limited text,
  source_url   text,
  source_note  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.chains is
  'チェーン橋渡し装置。誰もが知るチェーンの味を入口に、系統・ご当地へ渡す（North Star「広く」軸）';
comment on column public.chains.genre_slug is
  'genres.slug を緩く参照する（FK制約はしない。ジャンル未昇格でも投入できるようにするため。今回は全件 ramen）';
comment on column public.chains.pref_limited is
  '地域限定チェーン用（例: 県内のみ展開）。全国チェーンは NULL。今回は全件 NULL';
comment on column public.chains.source_url is '内部検証用の出典。UIには出さない（food_item_sources と同じ方針）';

-- -----------------------------------------------------------------------------
-- 2. chain_recommendations — チェーン → 推薦アイテム（アイテムへのリンクのみ）
-- -----------------------------------------------------------------------------
create table if not exists public.chain_recommendations (
  id           uuid primary key default gen_random_uuid(),
  chain_id     uuid not null references public.chains (id) on delete cascade,
  food_item_id uuid not null references public.food_items (id) on delete cascade,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (chain_id, food_item_id)
);

create index if not exists chain_recommendations_chain_id_idx
  on public.chain_recommendations (chain_id);
create index if not exists chain_recommendations_food_item_id_idx
  on public.chain_recommendations (food_item_id);
create index if not exists chains_genre_slug_idx on public.chains (genre_slug);

-- -----------------------------------------------------------------------------
-- 3. food_item_regions.relation_type — 「本場」を追加
--    発祥・名産地に次ぐ第3の型。「どこでも食べられるが、ここのは特別」を表現する
-- -----------------------------------------------------------------------------
alter table public.food_item_regions
  drop constraint if exists food_item_regions_relation_type_check;

alter table public.food_item_regions
  add constraint food_item_regions_relation_type_check
  check (relation_type in ('発祥', '名産地', '主要提供圏', '本場'));

-- -----------------------------------------------------------------------------
-- 4. food_item_regions.note_ja / note_en — 本場の「構造的理由の一文」
--    （名産地でも使ってよい。データはまだ無い）
-- -----------------------------------------------------------------------------
alter table public.food_item_regions add column if not exists note_ja text;
alter table public.food_item_regions add column if not exists note_en text;

-- -----------------------------------------------------------------------------
-- 5. genres.intro_ja / intro_en — 国民食型ジャンルの総論（今回はスキーマのみ）
-- -----------------------------------------------------------------------------
alter table public.genres add column if not exists intro_ja text;
alter table public.genres add column if not exists intro_en text;

-- -----------------------------------------------------------------------------
-- 6. updated_at 自動更新
-- -----------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.chains;
create trigger set_updated_at before update on public.chains
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 7. RLS + GRANT（init migration と同一パターン。書き込みは service_role のみ）
-- =============================================================================
grant select on public.chains, public.chain_recommendations to anon, authenticated;
grant select, insert, update, delete on public.chains, public.chain_recommendations to service_role;

alter table public.chains enable row level security;
alter table public.chain_recommendations enable row level security;

-- chains: マスタ。非公開情報を含まないため全行許可（genres と同じ方針）
drop policy if exists chains_select_all on public.chains;
create policy chains_select_all on public.chains
  for select using (true);

-- chain_recommendations: リンクのみで非公開情報を含まないため全行許可
drop policy if exists chain_recommendations_select_all on public.chain_recommendations;
create policy chain_recommendations_select_all on public.chain_recommendations
  for select using (true);

-- insert / update / delete のポリシーは作らない。
-- RLS有効かつポリシー不在 = 全拒否。service_role のみが書き込める。
