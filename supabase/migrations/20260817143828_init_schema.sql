-- =============================================================================
-- 初期スキーマ: 共通コア + タイプ別詳細テーブル
-- =============================================================================
-- 定義の一次情報源: .doc/20_data/01_models.md
-- 作成順序:          .doc/20_data/02_migrations.md §2
-- RLSポリシー:       .doc/10_system/06_security.md
--
-- 方針:
-- - PostgreSQL拡張は追加しない（PostGIS は封印。.doc/10_system/01_architecture.md §2.1）
--   座標は double precision の素の列で持ち、解禁時に生成列を足せる状態を保つ
-- - 全テーブルでRLSを有効化する。フェーズ1〜2は認証を持たないため
--   「published のみ匿名読み取り可・書き込み全拒否」となる
-- - shops はフェーズ1では作成しない（.doc/20_data/01_models.md §5）
-- - 再実行可能に書く（IF NOT EXISTS / DROP POLICY IF EXISTS）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. genres — ジャンルマスタ
-- -----------------------------------------------------------------------------
create table if not exists public.genres (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_ja        text not null,
  name_en        text not null,
  type           text not null check (type in ('dish', 'ingredient')),
  sort_order     integer not null default 0,
  default_source text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.genres is 'ジャンルマスタ。slug をそのままURLルーティングに使う（/ramen）';

-- -----------------------------------------------------------------------------
-- 2. food_items — 共通コア（地図・索引・検索が読む唯一のソース）
-- -----------------------------------------------------------------------------
create table if not exists public.food_items (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  type        text not null check (type in ('dish', 'ingredient')),
  genre_id    uuid not null references public.genres (id) on delete restrict,
  name_romaji text not null,
  origin_pref text,
  origin_city text,
  lat         double precision,
  lng         double precision,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 発祥地の物語を持たないアイテム（焼き鳥の部位等）に対応するため座標はNULL可。
  -- ただし片方だけの入力は不正とする。
  constraint food_items_latlng_both_or_neither
    check ((lat is null) = (lng is null)),
  -- 日本国内の妥当性チェック（.doc/20_data/02_migrations.md §3.3）
  constraint food_items_lat_range check (lat is null or (lat between 20 and 46)),
  constraint food_items_lng_range check (lng is null or (lng between 122 and 154))
);

comment on column public.food_items.name_romaji is 'ローマ字転写。言語ではなく転写のためコア側に置く';
comment on column public.food_items.lat is 'PostGIS封印中のため素の数値列。.doc/10_system/01_architecture.md §2.1';

-- -----------------------------------------------------------------------------
-- 3. food_item_translations — 自由記述の翻訳（言語追加＝行追加）
-- -----------------------------------------------------------------------------
create table if not exists public.food_item_translations (
  id           uuid primary key default gen_random_uuid(),
  food_item_id uuid not null references public.food_items (id) on delete cascade,
  locale       text not null check (locale in ('ja', 'en', 'zh-Hant', 'ko')),
  name         text not null,
  summary      text,
  history      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (food_item_id, locale)
);

comment on table public.food_item_translations is
  '自由記述の翻訳。マスタラベルはDBでなくアプリのi18n辞書ファイルで持つ（二層方式）';

-- -----------------------------------------------------------------------------
-- 4. food_item_sources — 出典（記事末尾に参考文献として表示）
-- -----------------------------------------------------------------------------
create table if not exists public.food_item_sources (
  id           uuid primary key default gen_random_uuid(),
  food_item_id uuid not null references public.food_items (id) on delete cascade,
  url          text,
  title        text not null,
  publisher    text,
  accessed_at  date,
  created_at   timestamptz not null default now()
);

comment on table public.food_item_sources is
  '参照するのは事実のみ。文章表現は必ず書き直す（転載禁止。.doc/40_operation/01_strategy.md §1.2）';

-- -----------------------------------------------------------------------------
-- 5. dish_details — dish型の詳細（フェーズ1は primary_style のみ入力）
-- -----------------------------------------------------------------------------
create table if not exists public.dish_details (
  food_item_id     uuid primary key references public.food_items (id) on delete cascade,
  primary_style    text check (primary_style in ('醤油', '味噌', '塩', '豚骨', 'その他')),
  -- 以下フェーズ2。スキーマのみ用意する
  noodle_thickness text,
  noodle_curl      text,
  richness         smallint check (richness is null or (richness between 1 and 5)),
  originator_shop  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.dish_details.richness is 'あっさり(1)⇔こってり(5)。フェーズ2';

-- -----------------------------------------------------------------------------
-- 6. food_item_regions — 地域リレーション（型付き・フェーズ1は器のみ）
-- -----------------------------------------------------------------------------
create table if not exists public.food_item_regions (
  id                uuid primary key default gen_random_uuid(),
  food_item_id      uuid not null references public.food_items (id) on delete cascade,
  pref              text not null,
  city              text,
  lat               double precision,
  lng               double precision,
  relation_type     text not null check (relation_type in ('発祥', '名産地', '主要提供圏')),
  is_representative boolean not null default false,
  created_at        timestamptz not null default now(),

  constraint food_item_regions_latlng_both_or_neither
    check ((lat is null) = (lng is null))
);

comment on column public.food_item_regions.is_representative is
  '代表名物フラグ（フェーズ2）。県とエリアで代表が変わるため food_items 側でなくここに持つ';

-- -----------------------------------------------------------------------------
-- 7. food_item_relations — アイテム間リンク（フェーズ1は器のみ）
-- -----------------------------------------------------------------------------
create table if not exists public.food_item_relations (
  id            uuid primary key default gen_random_uuid(),
  from_id       uuid not null references public.food_items (id) on delete cascade,
  to_id         uuid not null references public.food_items (id) on delete cascade,
  relation_type text not null,
  created_at    timestamptz not null default now(),
  unique (from_id, to_id, relation_type),
  constraint food_item_relations_no_self check (from_id <> to_id)
);

-- -----------------------------------------------------------------------------
-- 8. インデックス
-- -----------------------------------------------------------------------------
create index if not exists food_items_genre_id_idx on public.food_items (genre_id);
create index if not exists food_items_status_idx on public.food_items (status);
create index if not exists food_items_origin_pref_idx on public.food_items (origin_pref);
create index if not exists food_item_translations_food_item_id_idx
  on public.food_item_translations (food_item_id);
create index if not exists food_item_sources_food_item_id_idx
  on public.food_item_sources (food_item_id);
create index if not exists food_item_regions_food_item_id_idx
  on public.food_item_regions (food_item_id);
create index if not exists food_item_relations_from_id_idx on public.food_item_relations (from_id);
create index if not exists food_item_relations_to_id_idx on public.food_item_relations (to_id);

-- 全文検索（Postgres組み込みFTS。拡張は追加しない）
-- 'simple' 設定は日本語を語で分割しないが、フェーズ1の規模では前方一致・部分一致で足りる。
-- TODO: [日本語の分かち書きが必要になった時点で pg_bigm 等の導入を検討する。
--        .doc/10_system/01_architecture.md §2.1 の「検索処理はアプリ層で1箇所に隔離」に従い、
--        差し替え可能な状態を保つこと]
create index if not exists food_item_translations_fts_idx
  on public.food_item_translations
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(summary, '')));

-- -----------------------------------------------------------------------------
-- 9. updated_at 自動更新
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'genres', 'food_items', 'food_item_translations', 'dish_details'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- =============================================================================
-- 10. RLS
-- =============================================================================
-- フェーズ1〜2は認証を持たないが、anon key はクライアントに露出するため
-- RLS を省略すると誰でも全テーブルを読み書きできる。
-- 書き込みは service_role（RLSをバイパス）を使うサーバー側処理のみが行う。
-- =============================================================================

-- テーブル権限（RLSの手前のゲート）。
-- **RLSポリシーだけではアクセスできない。** service_role は RLS をバイパスするが、
-- テーブル権限は別途必要なので忘れると書き込み経路ごと塞がる。
grant usage on schema public to anon, authenticated, service_role;

-- 読み取りロール: SELECT のみ。**insert / update / delete は付与しない**
grant select on
  public.genres,
  public.food_items,
  public.food_item_translations,
  public.food_item_sources,
  public.dish_details,
  public.food_item_regions,
  public.food_item_relations
to anon, authenticated;

-- 書き込みロール: CSVインポート・管理オペレーションを行う service_role のみ
grant select, insert, update, delete on
  public.genres,
  public.food_items,
  public.food_item_translations,
  public.food_item_sources,
  public.dish_details,
  public.food_item_regions,
  public.food_item_relations
to service_role;

alter table public.genres                 enable row level security;
alter table public.food_items             enable row level security;
alter table public.food_item_translations enable row level security;
alter table public.food_item_sources      enable row level security;
alter table public.dish_details           enable row level security;
alter table public.food_item_regions      enable row level security;
alter table public.food_item_relations    enable row level security;

-- genres: マスタ。非公開情報を含まないため全行許可
drop policy if exists genres_select_all on public.genres;
create policy genres_select_all on public.genres
  for select using (true);

-- food_items: published のみ
drop policy if exists food_items_select_published on public.food_items;
create policy food_items_select_published on public.food_items
  for select using (status = 'published');

-- 子テーブル: 親の status を辿って判定する
drop policy if exists food_item_translations_select_published on public.food_item_translations;
create policy food_item_translations_select_published on public.food_item_translations
  for select using (
    exists (select 1 from public.food_items fi
             where fi.id = food_item_id and fi.status = 'published')
  );

drop policy if exists food_item_sources_select_published on public.food_item_sources;
create policy food_item_sources_select_published on public.food_item_sources
  for select using (
    exists (select 1 from public.food_items fi
             where fi.id = food_item_id and fi.status = 'published')
  );

drop policy if exists dish_details_select_published on public.dish_details;
create policy dish_details_select_published on public.dish_details
  for select using (
    exists (select 1 from public.food_items fi
             where fi.id = food_item_id and fi.status = 'published')
  );

drop policy if exists food_item_regions_select_published on public.food_item_regions;
create policy food_item_regions_select_published on public.food_item_regions
  for select using (
    exists (select 1 from public.food_items fi
             where fi.id = food_item_id and fi.status = 'published')
  );

-- food_item_relations: 両端を判定する。
-- 片側だけ見ると未公開アイテムの存在（ID）が推測できてしまうため
-- （.doc/10_system/06_security.md §2.2）
drop policy if exists food_item_relations_select_published on public.food_item_relations;
create policy food_item_relations_select_published on public.food_item_relations
  for select using (
    exists (select 1 from public.food_items f
             where f.id = from_id and f.status = 'published')
    and
    exists (select 1 from public.food_items t
             where t.id = to_id and t.status = 'published')
  );

-- insert / update / delete のポリシーは作らない。
-- RLS有効かつポリシー不在 = 全拒否。service_role のみが書き込める。
