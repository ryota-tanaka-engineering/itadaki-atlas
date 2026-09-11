-- =============================================================================
-- dish_details.primary_style をラーメン専用の固定4系統(+その他)から
-- ジャンルごとの自由テキストへ一般化する
-- =============================================================================
-- 背景: 洋食ジャンル（ピザ/パスタ/ライス/フライ/肉/その他）を皮切りに、今後も
-- 魚（青魚/白身/赤身/川魚）やそば（配合/食べ方）などジャンルごとに異なる系統チップを
-- 持たせたい。これまで primary_style は CHECK 制約でラーメンの4系統+その他に固定
-- されていたため、値集合をDB側で固定せず非空の短いテキストとして受け付けるよう緩める。
--
-- ラーメンの系統色（醤油/味噌/塩/豚骨）は UI 側（src/features/map/styles.ts の
-- RAMEN_STYLES / RAMEN_STYLE_COLORS）に閉じた表示ロジックとして残す。CLAUDE.md
-- 「デザイン」節の系統色規定（ラーメン内部・単一ジャンル時のみ）は変更しない。
--
-- 冪等: 同名制約を drop constraint if exists → add constraint で再作成するため、
-- 2回流しても同じ状態になる。
-- =============================================================================

alter table public.dish_details drop constraint if exists dish_details_primary_style_check;

alter table public.dish_details
  add constraint dish_details_primary_style_check
  check (primary_style is null or (length(primary_style) between 1 and 20));
