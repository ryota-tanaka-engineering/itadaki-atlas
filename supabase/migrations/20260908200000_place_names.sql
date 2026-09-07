-- =============================================================================
-- place_names — 市区町村名の他言語表記マスタ
-- =============================================================================
-- 背景: 実装部隊の報告「/en の本場・産地チップに市区町村名が日本語のまま
-- （例 "Tokyo / 中央区"）」対応。都道府県は既存の翻訳辞書（messages/*.json の
-- prefecture 名前空間）で足りるが、市区町村はデータ点数が多く辞書ファイルに
-- 手書きするのは非現実的なため、データ駆動（テーブル）で持つ。
--
-- 方針:
-- - 列に _ja/_en を付けない。pref/city は常に日本語（food_items.origin_city 等と
--   同じ表記）をキーにし、locale 別に翻訳行を持つ（food_item_translations と同じ
--   二層方式。.doc/20_data/01_models.md §1.3）。将来 zh-Hant/ko 等が増えても
--   行追加だけで対応できる
-- - 現時点では英語（en）のみ投入する（scripts/import-place-names.ts）
-- - 該当行が無い（未投入）場合はアプリ側で日本語のままフォールバックする
--   （UI側の責務。.doc 更新なしで壊れないようにするため NOT NULL 制約は緩め）
-- =============================================================================

create table if not exists public.place_names (
  pref       text not null,
  city       text not null,
  locale     text not null check (locale in ('en', 'zh-Hant', 'ko')),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (pref, city, locale)
);

comment on table public.place_names is
  '市区町村名の他言語表記（ローマ字・英訳等）。pref/city は日本語表記をキーにする。'
  '未投入の組み合わせは UI 側で日本語のままフォールバックする';

create index if not exists place_names_locale_idx on public.place_names (locale);

-- -----------------------------------------------------------------------------
-- updated_at 自動更新（public.set_updated_at は init migration で定義済み）
-- -----------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.place_names;
create trigger set_updated_at before update on public.place_names
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + GRANT（他のマスタテーブルと同一パターン。書き込みは service_role のみ）
-- -----------------------------------------------------------------------------
grant select on public.place_names to anon, authenticated;
grant select, insert, update, delete on public.place_names to service_role;

alter table public.place_names enable row level security;

drop policy if exists place_names_select_all on public.place_names;
create policy place_names_select_all on public.place_names
  for select using (true);

-- insert / update / delete のポリシーは作らない。
-- RLS有効かつポリシー不在 = 全拒否。service_role のみが書き込める。
