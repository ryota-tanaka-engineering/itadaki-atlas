-- =============================================================================
-- 「食べに行く前に」ガイドに“体験と場所”を追加
--   食の街（food-town）/ 市場・朝市（market）/ 祭りとフェス（festival）/
--   ビアガーデン（beer-garden）/ 酒蔵・醸造所見学（brewery-tour）/
--   工場見学・体験（factory-tour）
-- =============================================================================
-- 背景: これまでの guides は「マナー・注文攻略」等の“読み物”のみで、実在の場所へ
-- 送客する種別を持たなかった。横浜中華街・近江町市場・地域の祭り/フェス・
-- ビアガーデン・酒蔵/工場見学のような「行けば体験できる場所」を持たせるための拡張。
--
-- 日取りは具体的に断定しない（「例年◯月」「通年」程度に留める。CLAUDE.md
-- 体験原則3と同じく、具体的な開催日は書かない）。そのため season_note は
-- guides 側の単一列にせず、多言語前提の guide_translations 側に when_note として
-- 持つ（food_item_translations と同じ二層方式。.doc/20_data/01_models.md §3.10）。
--
-- 既存パターン踏襲（IF NOT EXISTS / DROP CONSTRAINT IF EXISTS / 冪等）。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. guides.kind に6種別を追加
-- -----------------------------------------------------------------------------
alter table public.guides drop constraint if exists guides_kind_check;
alter table public.guides add constraint guides_kind_check
  check (kind in (
    'ordering', 'paying', 'manners', 'finding', 'takeaway', 'seasons', 'shopping',
    'food-town', 'market', 'festival', 'beer-garden', 'brewery-tour', 'factory-tour'
  ));
comment on column public.guides.kind is
  'ガイドの種別: ordering 注文 / paying 支払い / manners マナー / finding 店の見つけ方 / '
  'takeaway 持ち帰り・土産 / seasons 季節・時間 / shopping 買う場所 / '
  'food-town 食の街（海外由来の食の街等） / market 市場・朝市 / festival 祭り・フェス / '
  'beer-garden ビアガーデン・屋上 / brewery-tour 酒蔵・醸造所見学 / factory-tour 工場見学・体験'
  '（2026-09-12 追加分は「体験と場所」＝実在の場所に送客する種別）';

-- -----------------------------------------------------------------------------
-- 2. guides に場所情報の任意列を追加
-- -----------------------------------------------------------------------------
alter table public.guides add column if not exists pref text;
alter table public.guides add column if not exists city text;
alter table public.guides add column if not exists lat double precision;
alter table public.guides add column if not exists lng double precision;

comment on column public.guides.pref is
  '場所を持つガイド（food-town/market/festival/beer-garden/brewery-tour/factory-tour等）の都道府県名。'
  '読み物系ガイド（ordering等）は NULL のまま';
comment on column public.guides.city is '市区町村名。NULL可（都道府県だけで十分な場合）';
comment on column public.guides.lat is '代表地点の緯度。座標が無いガイドは NULL（PositionBand は座標がある場合のみ表示）';
comment on column public.guides.lng is '代表地点の経度。lat とセットで持つ';

-- -----------------------------------------------------------------------------
-- 3. guide_translations に when_note（多言語の時期メモ）を追加
-- -----------------------------------------------------------------------------
alter table public.guide_translations add column if not exists when_note text;

comment on column public.guide_translations.when_note is
  '開催時期・営業時期のメモ（多言語）。具体的な日取りは書かず「例年5月」「通年」'
  '「定期的に開催されるので調べてみて」のように断定しない文体で書く'
  '（CLAUDE.md 体験原則3・ia-atlas-content Skill §2の文体規約）。読み物系ガイドは NULL';

-- -----------------------------------------------------------------------------
-- 4. guide_links.target_kind に pref / item を追加
-- -----------------------------------------------------------------------------
alter table public.guide_links drop constraint if exists guide_links_target_kind_check;
alter table public.guide_links add constraint guide_links_target_kind_check
  check (target_kind in ('genre', 'shelf', 'tag', 'pref', 'item'));
comment on column public.guide_links.target_kind is
  '参照先の種別: genre/shelf/tag（既存） + pref（都道府県slug。src/lib/prefectures.ts の '
  'PREF_SLUGS の値） + item（food_items.slug。個別アイテムへの直接リンク）。'
  'いずれもFK制約なしの疎な参照（chains.genre_slug と同じ方針）';

-- -----------------------------------------------------------------------------
-- 5. インデックス（pref/city で県ページの逆引きに使う）
-- -----------------------------------------------------------------------------
create index if not exists guides_pref_idx on public.guides (pref);
