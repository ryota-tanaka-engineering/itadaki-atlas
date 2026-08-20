-- =============================================================================
-- inquiries — 問い合わせフォームからの送信
-- =============================================================================
-- 方針:
-- - RLS を有効化する。anon/authenticated は INSERT のみ許可（with check (true)）
-- - SELECT ポリシーは作らない。問い合わせ内容（氏名・メール・本文）は個人情報
--   のため、読み取りは service_role（RLSをバイパス）のみに限定する
-- - 再実行可能に書く（IF NOT EXISTS / DROP POLICY IF EXISTS）
-- =============================================================================

create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('business', 'correction', 'other')),
  name       text not null check (char_length(name) between 1 and 100),
  email      text not null check (char_length(email) <= 254),
  message    text not null check (char_length(message) between 1 and 4000),
  locale     text not null check (locale in ('ja', 'en')),
  created_at timestamptz not null default now()
);

comment on table public.inquiries is
  '問い合わせフォームからの送信。個人情報を含むため SELECT は service_role のみ許可する';

-- -----------------------------------------------------------------------------
-- 権限（RLSの手前のゲート）
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- 書き込みロール: INSERT のみ。**select / update / delete は付与しない**
grant insert on public.inquiries to anon, authenticated;

-- service_role: 確認・管理オペレーション用に全権
grant select, insert, update, delete on public.inquiries to service_role;

alter table public.inquiries enable row level security;

-- anon/authenticated: INSERT のみ許可
drop policy if exists inquiries_insert_anon on public.inquiries;
create policy inquiries_insert_anon on public.inquiries
  for insert
  with check (true);

-- SELECT / UPDATE / DELETE のポリシーは作らない。
-- RLS有効かつポリシー不在 = 全拒否。service_role のみが読み書きできる。
