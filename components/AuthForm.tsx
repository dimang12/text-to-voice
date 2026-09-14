"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signIn, signInWithGoogle, signUp, type AuthState } from "@/app/(auth)/actions";

type Props = { mode: "signin" | "signup"; next: string };

export function AuthForm({ mode, next }: Props) {
  const t = useTranslations("auth");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  return (
    <div className="auth-card">
      <div className="brand">
        <div className="orb" />
        <div>
          <b>Voice Studio</b>
          <span>{t("tagline")}</span>
        </div>
      </div>
      <h1>{mode === "signin" ? t("signIn") : t("signUp")}</h1>

      <form action={signInWithGoogle}>
        <button className="btn block" type="submit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="#4285F4" stroke="none"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" stroke="none"/><path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" fill="#FBBC05" stroke="none"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" fill="#EA4335" stroke="none"/></svg>
          {t("continueGoogle")}
        </button>
      </form>

      <div className="divider">{t("or")}</div>

      <form action={formAction} className="auth-form">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="display_name">{t("displayName")}</label>
            <input className="input" id="display_name" name="display_name" autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{t("email")}</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">{t("password")}</label>
          <input className="input" id="password" name="password" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        </div>
        {state.error && <div className="alert">{state.error === "invalid" ? t("invalid") : state.error}</div>}
        {state.message === "checkEmail" && <div className="notice">{t("checkEmail")}</div>}
        <button className="btn primary block" type="submit" disabled={pending}>
          {mode === "signin" ? t("signIn") : t("signUp")}
        </button>
      </form>

      <div className="auth-foot">
        {mode === "signin" ? (
          <>{t("noAccount")} <Link href="/signup">{t("signUp")}</Link></>
        ) : (
          <>{t("haveAccount")} <Link href="/login">{t("signIn")}</Link></>
        )}
      </div>
    </div>
  );
}
