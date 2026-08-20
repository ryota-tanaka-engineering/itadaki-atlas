"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  CONTACT_CATEGORIES,
  createContactSchema,
  type ContactCategory,
  type ContactFormValues,
  type ContactLocale,
} from "@/features/contact/schemas";

const CATEGORY_LABELS: Record<ContactLocale, Record<ContactCategory, string>> = {
  ja: {
    business: "事業者の方（掲載・タイアップ）",
    correction: "内容の訂正・指摘",
    other: "その他",
  },
  en: {
    business: "Business inquiry (listing / partnership)",
    correction: "Correction or factual issue",
    other: "Other",
  },
};

const COPY: Record<
  ContactLocale,
  {
    categoryLabel: string;
    nameLabel: string;
    emailLabel: string;
    messageLabel: string;
    submit: string;
    submitting: string;
    success: string;
    failure: string;
  }
> = {
  ja: {
    categoryLabel: "種別",
    nameLabel: "お名前",
    emailLabel: "メールアドレス",
    messageLabel: "内容",
    submit: "送信する",
    submitting: "送信中…",
    success: "送信しました。内容を確認のうえ、必要に応じてご連絡します。",
    failure: "送信に失敗しました。時間をおいて再度お試しください。",
  },
  en: {
    categoryLabel: "Category",
    nameLabel: "Name",
    emailLabel: "Email address",
    messageLabel: "Message",
    submit: "Send",
    submitting: "Sending…",
    success: "Thank you — we've received your message and will follow up if needed.",
    failure: "Something went wrong. Please try again in a moment.",
  },
};

/**
 * 問い合わせフォーム（クライアント側)。
 *
 * 認証を持たないフェーズ1〜2のため、RLS で INSERT のみを許可した
 * inquiries テーブルへブラウザから直接書き込む
 * （supabase/migrations/20260821000000_inquiries.sql）。
 * SELECT ポリシーは存在しないため、この経路からは読み返せない。
 */
export function ContactForm({ locale }: { locale: ContactLocale }) {
  const t = COPY[locale];
  const categoryLabels = CATEGORY_LABELS[locale];

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(createContactSchema(locale)),
    defaultValues: { category: undefined, name: "", email: "", message: "", website: "" },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setSubmitError(false);

    // honeypot: 実ユーザーには見えない欄。値が入っていればボットとみなし、
    // 送信はせず成功扱いで静かに捨てる（相手に気づかせない）
    if (values.website) {
      setSubmitted(true);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("inquiries").insert({
      category: values.category,
      name: values.name,
      email: values.email,
      message: values.message,
      locale,
    });

    if (error) {
      console.error("contact: failed to submit inquiry", error);
      setSubmitError(true);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
        {t.success}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* honeypot: 画面外に配置して隠す。display:none/visibility:hidden にしない
          （それらだけを避けるボットがいるため）。実ユーザーのタブ順からは除外する */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor="website">Website</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t.categoryLabel}</legend>
        <div className="space-y-2">
          {CONTACT_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <input type="radio" value={category} className="size-4" {...register("category")} />
              {categoryLabels[category]}
            </label>
          ))}
        </div>
        {errors.category && (
          <p role="alert" className="text-xs text-destructive">
            {errors.category.message}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="name">{t.nameLabel}</Label>
        <Input
          id="name"
          type="text"
          maxLength={100}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="text-xs text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t.emailLabel}</Label>
        <Input
          id="email"
          type="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{t.messageLabel}</Label>
        <Textarea
          id="message"
          rows={6}
          maxLength={4000}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          {...register("message")}
        />
        {errors.message && (
          <p id="message-error" role="alert" className="text-xs text-destructive">
            {errors.message.message}
          </p>
        )}
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {t.failure}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
