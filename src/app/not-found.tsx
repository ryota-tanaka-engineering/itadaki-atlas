import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">ページが見つかりません</h1>
      <p className="text-muted-foreground text-sm">
        お探しのページは移動または削除された可能性があります。
      </p>
      {/* 遷移する要素なので Button コンポーネントではなくスタイルのみ適用する。
          Button + nativeButton={false} は <a> に role="button" を付けてしまい、
          スクリーンリーダーがリンクをボタンとして読み上げる（WCAG 2.2 AA / .doc/30_features/01_requirements.md F-07）。 */}
      <Link href="/" className={buttonVariants()}>
        トップへ戻る
      </Link>
    </div>
  );
}
