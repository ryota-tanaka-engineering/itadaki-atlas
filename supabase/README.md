# supabase/

Itadaki Atlas の Supabase マイグレーションと Seed データを置く。

## ルール

- **マイグレーションは `supabase-migration` Skill に従って作成する。** 命名規則・冪等性・本番安全性の担保は同 Skill の手順が正
- **RLSポリシー無しでのテーブル追加は禁止。** テーブル作成と RLS 有効化・ポリシー付与は**同一コミット**に含める
- テーブル定義の一次情報源は `.doc/20_data/01_models.md`。**スキーマを変える前に同ファイルを更新する**
- マイグレーションを追加・変更したら、**同一コミットで型を再生成する**

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## 現状

**マイグレーションはまだ無い。** データモデルは `.doc/20_data/01_models.md` で確定しているが、Supabase プロジェクトの作成が未了のため SQL は書いていない。

作成順序は Platform `../../.doc/20_data/02_migrations.md` §2 を参照（`genres` → `food_items` → 翻訳/出典/詳細 → 地域/リレーション → インデックス）。

## PostgreSQL 拡張

**フェーズ1では拡張を追加しない。** PostGIS は封印中（解禁条件は `.doc/10_system/01_architecture.md` §2.1）。座標は `double precision` の素の列で持つ。

## Seed

開発/CI用 Seed は `supabase/seed.sql` に置く。**`draft` レコードと翻訳欠けレコードを意図的に含める**こと（RLS とフォールバックの検証に必要）。詳細は Platform `../../.doc/20_data/02_migrations.md` §4。
