-- =============================================================================
-- guide_links.target_kind に scene（場面）を追加
-- =============================================================================
-- 背景: ガイドに「場面」の軸を足し、場面 ⇄ ジャンル ⇄ 料理 ⇄ ガイド の相互遷移を
-- 作るため（data/ledgers/GUIDE_SCENES_IMPL_BRIEF.md）。場面のマスタは
-- src/features/guide/scenes.ts のコード定数で持つ（DBテーブルは作らない。
-- guides.pref と同じ「マスタはコード・存在検証はアプリ層」の方針）。
--
-- 制約の付け替えのみ（データ変更なし）。冪等（20260912200000_guide_places.sql と
-- 同じ書き方）。
-- =============================================================================
alter table public.guide_links drop constraint if exists guide_links_target_kind_check;
alter table public.guide_links add constraint guide_links_target_kind_check
  check (target_kind in ('genre', 'shelf', 'tag', 'pref', 'item', 'scene'));
comment on column public.guide_links.target_kind is
  '参照先の種別: genre/shelf/tag（既存） + pref（都道府県slug。src/lib/prefectures.ts の '
  'PREF_SLUGS の値） + item（food_items.slug。個別アイテムへの直接リンク） + '
  'scene（場面slug。src/features/guide/scenes.ts の GUIDE_SCENES の値。2026-09-24追加）。'
  'いずれもFK制約なしの疎な参照（chains.genre_slug と同じ方針）';
