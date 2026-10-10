-- ジャンルページの系統の並び順（2026-10-10、寿司の系統付与）。
-- 今は「一覧で最初に出た順」に系統見出しが並ぶ。寿司のように形で分ける系統は
-- 握り→巻き→… と読み手が知っている順に並べたいので、genre_styles に順序を持たせる。
-- NULL は従来どおり出現順（順序つきの系統のあと）。
alter table public.genre_styles add column if not exists sort_order smallint;
comment on column public.genre_styles.sort_order is
  'ジャンルページでの系統の並び順（小さいほど先）。NULL は一覧の出現順で順序つきの後ろ';
