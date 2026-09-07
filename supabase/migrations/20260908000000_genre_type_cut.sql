-- =============================================================================
-- genres.type に "cut"（部位）を追加
-- =============================================================================
-- 背景: トップ「種類からさがす」で銘柄豚と豚肉の部位が同列に並ぶ問題（本番レビュー）。
-- 銘柄（銘柄豚・和牛・地鶏・米の品種・魚介）は「どこの誰が育てたか」という土地に
-- 結びつく食材、部位（牛肉の部位・豚肉の部位）は「一頭のどこか」という土地に依らない
-- 図鑑情報。データ上は両方とも genres.type = 'ingredient' の同型ジャンルで区別できて
-- いなかったため、第3の値 "cut" を追加し、既存の beef-cuts / pork-cuts を移行する。
--
-- food_items.type は変更しない（部位アイテムは引き続き ingredient。地図ピン■もそのまま）。
-- 制約名は `\d public.genres` で確認済み: genres_type_check。
-- 冪等: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT は再実行しても同じ制約を作り直す
-- だけ（エラーにならない）。UPDATE は旧値ガード付きなので2回目は 0 行（no-op）。
-- =============================================================================

ALTER TABLE public.genres DROP CONSTRAINT IF EXISTS genres_type_check;
ALTER TABLE public.genres
  ADD CONSTRAINT genres_type_check CHECK (type = ANY (ARRAY['dish'::text, 'ingredient'::text, 'cut'::text]));

UPDATE public.genres
   SET type = 'cut', updated_at = NOW()
 WHERE slug IN ('beef-cuts', 'pork-cuts')
   AND type = 'ingredient';
