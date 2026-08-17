"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">エラーが発生しました</h1>
      <p className="text-muted-foreground text-sm">
        ページの表示中に問題が発生しました。時間をおいて再度お試しください。
      </p>
      <Button onClick={() => reset()}>もう一度試す</Button>
    </div>
  );
}
