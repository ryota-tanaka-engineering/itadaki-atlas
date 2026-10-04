-- =============================================================================
-- dish_details のフェーズ2属性（麺の太さ・麺の形・濃さ）を本格使用に移す
-- =============================================================================
-- 背景: 詳細ページの情報を厚くする決定（2026-10-04。ユーザー「詳細の方に情報を厚くすべき」）。
-- 麺の太さ・形・濃さをカバーの「事実チップ」に出し、将来のフィルタ（こってり×太麺）の
-- 構造化タグとして使う（.doc/20_data/01_models.md §3.5、ia-atlas-content Skill §2.5
-- 「タグは客観的に一意に決まる値だけ」）。
--
-- 列は 20260817 の init で用意済み（スキーマのみ）。ここでは語彙を CHECK 制約で固定し、
-- 自由テキストのブレ（「中太」「中太麺」「やや太」）を投入時点で弾く。
-- 値は日本語の語彙で持ち、英語表記はアプリの辞書（messages/*.json `noodle`）で引く
-- （マスタラベルの二層方式。.doc/10_system/01_architecture.md §6.2.2）。
--
-- originator_shop は引き続きスキーマのみ（中立な媒体として元祖店の表示方針が未決）。
-- 既存パターン踏襲（DROP CONSTRAINT IF EXISTS / 冪等）。
-- =============================================================================

alter table public.dish_details drop constraint if exists dish_details_noodle_thickness_check;
alter table public.dish_details add constraint dish_details_noodle_thickness_check
  check (noodle_thickness is null or noodle_thickness in ('極細', '細', '中細', '中太', '太', '極太'));

alter table public.dish_details drop constraint if exists dish_details_noodle_curl_check;
alter table public.dish_details add constraint dish_details_noodle_curl_check
  check (noodle_curl is null or noodle_curl in ('ストレート', 'ちぢれ', '手もみ'));

comment on column public.dish_details.noodle_thickness is
  '麺の太さ（極細/細/中細/中太/太/極太）。本文・概要に書かれた事実から取る。不明は NULL。'
  '2026-10 からラーメンで本格使用（カバーの事実チップ）';
comment on column public.dish_details.noodle_curl is
  '麺の形（ストレート/ちぢれ/手もみ）。不明は NULL。2026-10 からラーメンで本格使用';
comment on column public.dish_details.richness is
  'あっさり(1)⇔こってり(5)。ジャンル内の相対尺度（定義: data/ledgers/HOWTO_BRIEF.md）。不明は NULL。'
  '2026-10 からラーメンで本格使用';
