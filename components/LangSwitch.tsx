"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";

export function LangSwitch({ locale }: { locale: string }) {
  const t = useTranslations("topbar");
  const router = useRouter();
  const [pending, start] = useTransition();
  function choose(l: string) {
    if (l === locale) return;
    start(async () => {
      await setLocale(l);
      router.refresh();
    });
  }
  return (
    <div className="lang" role="group" aria-label={t("language")} style={{ opacity: pending ? 0.6 : 1 }}>
      <button type="button" className={locale === "en" ? "on" : ""} onClick={() => choose("en")} lang="en">EN</button>
      <button type="button" className={locale === "km" ? "on" : ""} onClick={() => choose("km")} lang="km">ខ្មែរ</button>
    </div>
  );
}
