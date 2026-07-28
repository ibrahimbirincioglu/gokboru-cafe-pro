import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="page-shell">
      <section className="login-card">
        <p className="eyebrow">Erişim reddedildi</p>
        <h1>Bu sayfa için yetkiniz yok.</h1>
        <p className="muted">
          Oturumunuz açık ancak rolünüz bu çalışma alanına erişemiyor.
        </p>
        <Link className="button button-primary" href="/">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
