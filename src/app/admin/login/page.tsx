import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "./actions";
import { redirectAuthenticatedUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Admin Girişi",
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function AdminLoginPage({
  searchParams,
}: LoginPageProps) {
  await redirectAuthenticatedUser();
  const params = await searchParams;
  const errorMessage =
    params.error === "rate-limited"
      ? "Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin."
      : params.error
        ? "Kullanıcı adı veya parola hatalı."
        : null;

  return (
    <main className="page-shell">
      <section className="login-card" aria-labelledby="login-title">
        <Link className="back-link" href="/">
          ← Ana sayfa
        </Link>
        <p className="eyebrow">Yönetim paneli</p>
        <h1 id="login-title">Admin girişi</h1>
        <p className="muted">
          OWNER, ADMIN, CASHIER ve WAITER hesapları güvenli çalışma
          alanlarına buradan giriş yapabilir.
        </p>
        {errorMessage ? (
          <p aria-live="polite" className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <form action={loginAction} className="login-form">
          {params.next ? (
            <input name="next" type="hidden" value={params.next} />
          ) : null}
          <label htmlFor="username">Kullanıcı adı</label>
          <input
            autoComplete="username"
            id="username"
            name="username"
            maxLength={64}
            minLength={3}
            required
            type="text"
          />
          <label htmlFor="password">Parola</label>
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            maxLength={200}
            minLength={8}
            required
            type="password"
          />
          <button type="submit">
            Güvenli giriş
          </button>
        </form>
      </section>
    </main>
  );
}
