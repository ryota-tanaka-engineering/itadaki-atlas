-- =============================================================================
-- 情報構造（2026-08確定）の反映: 棚マスタ + ジャンル昇格制 + タグ + 関係語彙 + 本文
-- =============================================================================
-- 背景: .doc/00_concept で確定した「タグ一元 + 排他棚1本」構造をスキーマに反映する。
--   1. shelves（棚28本: 料理10・食材9・仕込み9）マスタを新設
--   2. genres / food_items に shelf_slug（排他・NOT NULL）を追加
--   3. food_items.genre_id を nullable 化（棚内「その他」= genre_id NULL）
--   4. ジャンル昇格制の適用: 実在語+20件未満の8ジャンルを「その他」へ降格・削除
--   5. tags マスタ + food_item_tags 中間テーブルを新設（語彙投入のみ。付け作業は別スコープ）
--   6. food_item_relations.type を4語彙（lineage/sibling/contrast/uses）に正規化
--   7. food_item_translations に body_md（本文Markdown）を追加
--
-- 全体を通じて再実行可能に書く（IF NOT EXISTS / 旧値ガード付きUPDATE / 冪等DELETE）。
-- 参照: .claude/skills/ia-atlas-content/SKILL.md §4、CLAUDE.md「情報構造（2026-08確定）」
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. shelves — 棚マスタ（28行。排他・全アイテム必須の分類軸）
-- -----------------------------------------------------------------------------
create table if not exists public.shelves (
  slug       text primary key,
  name_ja    text not null,
  name_en    text not null,
  grp        text not null check (grp in ('dish', 'ingredient', 'preparation')),
  sort_order integer not null default 0
);

comment on table public.shelves is
  '棚マスタ（料理10・食材9・仕込み9=28）。全アイテムが必ず1つ所属する排他分類。URL・地図記号・数え上げの単位';

insert into public.shelves (slug, name_ja, name_en, grp, sort_order) values
  ('noodles',    '麺',           'Noodles',              'dish', 1),
  ('rice',       'ごはんもの',   'Rice dishes',           'dish', 2),
  ('bread',      'パン・サンド', 'Bread',                 'dish', 3),
  ('griddle',    '粉もの',       'Griddle & dumplings',   'dish', 4),
  ('grilled',    '焼きもの',     'Grilled',               'dish', 5),
  ('fried',      '揚げもの',     'Fried',                 'dish', 6),
  ('hotpot',     '鍋・汁もの',   'Hot pot & soups',       'dish', 7),
  ('raw',        '生食',         'Raw',                   'dish', 8),
  ('sweets',     '甘味',         'Sweets',                'dish', 9),
  ('homestyle',  '惣菜',         'Home-style',            'dish', 10),

  ('meat',       '肉',           'Meat',                  'ingredient', 11),
  ('seafood',    '魚介',         'Seafood',                'ingredient', 12),
  ('seaweed',    '海藻',         'Seaweed',                'ingredient', 13),
  ('vegetables', '野菜',         'Vegetables',             'ingredient', 14),
  ('tubers',     'いも・豆',     'Tubers & legumes',       'ingredient', 15),
  ('fruits',     '果物・柑橘',   'Fruits & citrus',        'ingredient', 16),
  ('grains',     '米・穀物',     'Grains',                 'ingredient', 17),
  ('mushrooms',  'きのこ・山菜', 'Mushrooms & sansai',     'ingredient', 18),
  ('dairy',      '卵・乳',       'Eggs & dairy',           'ingredient', 19),

  ('sake',        '酒',                     'Sake & brews',         'preparation', 20),
  ('drinks',      '茶・飲料',               'Tea & drinks',          'preparation', 21),
  ('seasonings',  '調味料',                 'Seasonings',            'preparation', 22),
  ('dashi',       '出汁',                   'Dashi',                 'preparation', 23),
  ('dried',       '乾物',                   'Dried goods',           'preparation', 24),
  ('fermented',   '発酵・保存',             'Fermented & preserved', 'preparation', 25),
  ('processed',   '練り物・豆腐・こんにゃく', 'Processed staples',  'preparation', 26),
  ('cured',       '食肉・乳加工',           'Cured meat & dairy',    'preparation', 27),
  ('confections', '土産菓子',               'Confections',           'preparation', 28)
on conflict (slug) do update set
  name_ja    = excluded.name_ja,
  name_en    = excluded.name_en,
  grp        = excluded.grp,
  sort_order = excluded.sort_order
where (shelves.name_ja, shelves.name_en, shelves.grp, shelves.sort_order)
  is distinct from (excluded.name_ja, excluded.name_en, excluded.grp, excluded.sort_order);

-- -----------------------------------------------------------------------------
-- 2. genres.shelf_slug — 棚への所属（排他・NOT NULL）
-- -----------------------------------------------------------------------------
alter table public.genres
  add column if not exists shelf_slug text references public.shelves (slug);

update public.genres set shelf_slug = case slug
    when 'ramen'        then 'noodles'
    when 'udon'          then 'noodles'
    when 'soba'          then 'noodles'
    when 'sushi'         then 'rice'
    when 'yakitori'      then 'grilled'
    when 'wagyu'         then 'meat'
    when 'oyster'        then 'seafood'
    when 'yakisoba'      then 'noodles'
    when 'champon'       then 'noodles'
    when 'okinawa-soba'  then 'noodles'
    when 'somen'         then 'noodles'
    when 'reimen'        then 'noodles'
    when 'pasta'         then 'noodles'
    when 'kyodo-men'     then 'noodles'
  end
 where slug in (
    'ramen', 'udon', 'soba', 'sushi', 'yakitori', 'wagyu',
    'oyster', 'yakisoba', 'champon', 'okinawa-soba', 'somen', 'reimen', 'pasta', 'kyodo-men'
  )
  and shelf_slug is distinct from case slug
    when 'ramen'        then 'noodles'
    when 'udon'          then 'noodles'
    when 'soba'          then 'noodles'
    when 'sushi'         then 'rice'
    when 'yakitori'      then 'grilled'
    when 'wagyu'         then 'meat'
    when 'oyster'        then 'seafood'
    when 'yakisoba'      then 'noodles'
    when 'champon'       then 'noodles'
    when 'okinawa-soba'  then 'noodles'
    when 'somen'         then 'noodles'
    when 'reimen'        then 'noodles'
    when 'pasta'         then 'noodles'
    when 'kyodo-men'     then 'noodles'
  end;

alter table public.genres alter column shelf_slug set not null;

-- -----------------------------------------------------------------------------
-- 3. food_items.shelf_slug — 棚への所属（排他・NOT NULL）
--    既存行は所属ジャンルの棚をコピーして埋める（ジャンル降格の前に実行する）
-- -----------------------------------------------------------------------------
alter table public.food_items
  add column if not exists shelf_slug text references public.shelves (slug);

update public.food_items fi
   set shelf_slug = g.shelf_slug
  from public.genres g
 where fi.genre_id = g.id
   and fi.shelf_slug is distinct from g.shelf_slug;

alter table public.food_items alter column shelf_slug set not null;

-- food_items.genre_id を nullable 化（棚内「その他」= genre_id NULL）
alter table public.food_items alter column genre_id drop not null;

-- -----------------------------------------------------------------------------
-- 4. ジャンル昇格制の適用: 実在語+20件未満の8ジャンルを「その他」へ降格
--    判定は悉皆調査の規模基準で決定済み（CLAUDE.md「情報構造（2026-08確定）」）。
--    既知slugを狙うため、既に降格済み（行が無い）環境では no-op。
-- -----------------------------------------------------------------------------
update public.food_items
   set genre_id = null
 where genre_id in (
    select id from public.genres
     where slug in (
       'oyster', 'yakisoba', 'champon', 'okinawa-soba', 'somen', 'reimen', 'pasta', 'kyodo-men'
     )
  )
  and genre_id is not null;

delete from public.genres
 where slug in (
    'oyster', 'yakisoba', 'champon', 'okinawa-soba', 'somen', 'reimen', 'pasta', 'kyodo-men'
  );

-- -----------------------------------------------------------------------------
-- 5. tags — タグマスタ + food_item_tags 中間テーブル（語彙投入のみ。付け作業はスコープ外）
-- -----------------------------------------------------------------------------
create table if not exists public.tags (
  slug       text primary key,
  kind       text not null check (kind in ('味・特性', '素材', '調理', '形状・食べ方', '場面', '系譜')),
  name_ja    text not null,
  name_en    text not null,
  definition text not null,
  synonyms   text[] not null default '{}'
);

comment on table public.tags is
  'タグ一元語彙（棚と直交）。付与は food_item_tags で行う。examples/estimated_count等の調査メタはDBに持たない';

create table if not exists public.food_item_tags (
  food_item_id uuid not null references public.food_items (id) on delete cascade,
  tag_slug     text not null references public.tags (slug) on delete restrict,
  primary key (food_item_id, tag_slug)
);

create index if not exists food_item_tags_tag_slug_idx on public.food_item_tags (tag_slug);

-- -----------------------------------------------------------------------------
-- 6. food_item_relations.type — 関係4語彙への正規化
--    源流/派生系→lineage、対比→contrast、代表ネタ・使用食材→uses
--    既存type値はDBで確認済み: 代表ネタ / 対比 / 派生（このローカルDBの実データ）
-- -----------------------------------------------------------------------------
update public.food_item_relations
   set relation_type = case relation_type
     when '源流'       then 'lineage'
     when '派生'       then 'lineage'
     when '対比'       then 'contrast'
     when '代表ネタ'   then 'uses'
     when '使用食材'   then 'uses'
     else relation_type
   end
 where relation_type in ('源流', '派生', '対比', '代表ネタ', '使用食材');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'food_item_relations_type_check'
  ) then
    alter table public.food_item_relations
      add constraint food_item_relations_type_check
      check (relation_type in ('lineage', 'sibling', 'contrast', 'uses'));
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 7. food_item_translations.body_md — 本文Markdown（nullable。UIは今回触らない）
-- -----------------------------------------------------------------------------
alter table public.food_item_translations
  add column if not exists body_md text;

-- -----------------------------------------------------------------------------
-- 8. インデックス
-- -----------------------------------------------------------------------------
create index if not exists genres_shelf_slug_idx on public.genres (shelf_slug);
create index if not exists food_items_shelf_slug_idx on public.food_items (shelf_slug);

-- =============================================================================
-- 9. GRANT / RLS（既存 genres と同じ流儀。RLSポリシーだけでは不十分でGRANTが手前のゲート）
-- =============================================================================

grant select on public.shelves, public.tags, public.food_item_tags to anon, authenticated;
grant select, insert, update, delete on public.shelves, public.tags, public.food_item_tags to service_role;

alter table public.shelves        enable row level security;
alter table public.tags           enable row level security;
alter table public.food_item_tags enable row level security;

-- shelves / tags: マスタ。非公開情報を含まないため全行許可
drop policy if exists shelves_select_all on public.shelves;
create policy shelves_select_all on public.shelves
  for select using (true);

drop policy if exists tags_select_all on public.tags;
create policy tags_select_all on public.tags
  for select using (true);

-- food_item_tags: 子テーブル。親(food_items)の status を辿って判定する
drop policy if exists food_item_tags_select_published on public.food_item_tags;
create policy food_item_tags_select_published on public.food_item_tags
  for select using (
    exists (select 1 from public.food_items fi
             where fi.id = food_item_id and fi.status = 'published')
  );

-- insert / update / delete のポリシーは作らない。RLS有効かつポリシー不在 = 全拒否。
