import { z } from "zod";

/**
 * 問い合わせフォームのバリデーションスキーマ。
 *
 * エラーメッセージも二言語が必要なため、locale を受け取って
 * ロケール別のメッセージを焼き込んだスキーマを都度生成する
 * （メッセージを messages/*.json と二重管理しない）。
 */

export const CONTACT_CATEGORIES = ["business", "correction", "other"] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export type ContactLocale = "ja" | "en";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALIDATION_MESSAGES: Record<
  ContactLocale,
  {
    categoryRequired: string;
    nameRequired: string;
    nameMax: string;
    emailRequired: string;
    emailInvalid: string;
    emailMax: string;
    messageRequired: string;
    messageMax: string;
  }
> = {
  ja: {
    categoryRequired: "種別を選択してください。",
    nameRequired: "お名前を入力してください。",
    nameMax: "お名前は100字以内で入力してください。",
    emailRequired: "メールアドレスを入力してください。",
    emailInvalid: "メールアドレスの形式が正しくありません。",
    emailMax: "メールアドレスは254字以内で入力してください。",
    messageRequired: "内容を入力してください。",
    messageMax: "内容は4000字以内で入力してください。",
  },
  en: {
    categoryRequired: "Please choose a category.",
    nameRequired: "Please enter your name.",
    nameMax: "Name must be 100 characters or fewer.",
    emailRequired: "Please enter your email address.",
    emailInvalid: "Please enter a valid email address.",
    emailMax: "Email address must be 254 characters or fewer.",
    messageRequired: "Please enter your message.",
    messageMax: "Message must be 4000 characters or fewer.",
  },
};

export function createContactSchema(locale: ContactLocale) {
  const m = VALIDATION_MESSAGES[locale];

  return z.object({
    category: z.enum(CONTACT_CATEGORIES, { message: m.categoryRequired }),
    name: z.string().trim().min(1, m.nameRequired).max(100, m.nameMax),
    email: z
      .string()
      .trim()
      .min(1, m.emailRequired)
      .max(254, m.emailMax)
      .refine((value) => EMAIL_PATTERN.test(value), { message: m.emailInvalid }),
    message: z.string().trim().min(1, m.messageRequired).max(4000, m.messageMax),
    // honeypot: 人間には見えない入力。値が入っていたらボットとみなし静かに捨てる
    website: z.string().optional(),
  });
}

export type ContactFormValues = z.infer<ReturnType<typeof createContactSchema>>;
