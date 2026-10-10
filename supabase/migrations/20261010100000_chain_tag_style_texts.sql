-- =============================================================================
-- 文脈の文を足す: チェーン創業メモの英訳・タグの英語定義と総論・ジャンルの系統ごとの一文
-- =============================================================================
-- 背景: ユーザー選択 2026-10-04「ジャンルページの系統解説」「チェーン創業メモの英訳」「タグの総論」。
-- 体験原則2「選択の直後に必ず文脈を出す」の延長。あわせて /en のタグページに日本語の定義が
-- そのまま出ていた不具合（tags.definition は日本語のみ）を直す。
-- 既存パターン踏襲（IF NOT EXISTS / 冪等）。
-- =============================================================================

-- 1. chains: 創業メモの英語（founded_note は日本語のみだったため /en では出していなかった）
alter table public.chains add column if not exists founded_note_en text;
comment on column public.chains.founded_note_en is
  '創業メモの英語（founded_note の事実の翻訳。足さない・削らない）。2026-10-10 追加';

-- 2. tags: 英語の定義と、日英の総論（タグページの一覧の前に出す文脈）
alter table public.tags add column if not exists definition_en text;
alter table public.tags add column if not exists intro_ja text;
alter table public.tags add column if not exists intro_en text;
comment on column public.tags.definition_en is '定義（definition）の英語。/en のタグページとトップのタグ絞り込みで使う';
comment on column public.tags.intro_ja is 'タグの総論（このタグで束ねると何が見えるか）。80〜150字。タグページの一覧の前';
comment on column public.tags.intro_en is 'タグの総論（英語）';

-- 3. genre_styles: ジャンルページの系統見出しの直下に置く一文（place_names と同じ二層方式）
create table if not exists public.genre_styles (
  genre_slug text not null,
  style      text not null,
  locale     text not null check (locale in ('ja', 'en', 'zh-Hant', 'ko')),
  intro      text not null check (length(intro) between 1 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (genre_slug, style, locale)
);
comment on table public.genre_styles is
  'ジャンル内の系統（dish_details.primary_style の値）ごとの一文解説。style は日本語の値そのものをキーにする。'
  'genre_slug は genres.slug を緩く参照する（chains.genre_slug と同じく FK なし）';

drop trigger if exists set_updated_at on public.genre_styles;
create trigger set_updated_at before update on public.genre_styles
  for each row execute function public.set_updated_at();

grant select on public.genre_styles to anon, authenticated;
grant select, insert, update, delete on public.genre_styles to service_role;
alter table public.genre_styles enable row level security;
drop policy if exists genre_styles_select_all on public.genre_styles;
create policy genre_styles_select_all on public.genre_styles for select using (true);
