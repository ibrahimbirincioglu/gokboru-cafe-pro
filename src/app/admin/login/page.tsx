import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Girişi",
};

export default function AdminLoginPage() {
  return (
    <main className="page-shell">
      <section className="login-card" aria-labelledby="login-title">
        <Link className="back-link" href="/">
          ← Ana sayfa
        </Link>
        <p className="eyebrow">Yönetim paneli</p>
        <h1 id="login-title">Admin girişi</h1>
        <p className="muted">
          Kimlik doğrulama sonraki aşamada güvenli sunucu oturumuyla
          tamamlanacaktır.
        </p>
        <form className="login-form">
          <label htmlFor="username">Kullanıcı adı</label>
          <input
            autoComplete="username"
            disabled
            id="username"
            name="username"
            placeholder="Henüz etkin değil"
            type="text"
          />
          <label htmlFor="password">Parola</label>
          <input
            autoComplete="current-password"
            disabled
            id="password"
            name="password"
            placeholder="Henüz etkin değil"
            type="password"
          />
          <button disabled type="button">
            Giriş altyapısı hazırlanıyor
          </button>
        </form>
      </section>
    </main>
  );
}
