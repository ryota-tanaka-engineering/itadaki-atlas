-- =============================================================================
-- guides.kind に「買う場所（shopping）」を追加
-- =============================================================================
-- 背景: コンビニ・スーパー・デパ地下・駅ナカ・道の駅と市場のガイドを載せるため。
-- 制約の付け替えのみ（データ変更なし）。冪等。
-- =============================================================================
alter table public.guides drop constraint if exists guides_kind_check;
alter table public.guides add constraint guides_kind_check
  check (kind in ('ordering', 'paying', 'manners', 'finding', 'takeaway', 'seasons', 'shopping'));
comment on column public.guides.kind is
  'ガイドの種別: ordering 注文 / paying 支払い / manners マナー / finding 店の見つけ方 / takeaway 持ち帰り・土産 / seasons 季節・時間 / shopping 買う場所（コンビニ・スーパー・デパ地下・駅ナカ・市場）';
