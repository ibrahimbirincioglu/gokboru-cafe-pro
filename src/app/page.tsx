import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Gökbörü Cafe</p>
        <h1 id="hero-title">Kafenin dijital merkezi hazırlanıyor.</h1>
        <p className="lead">
          Modern web sitesi, QR menü ve işletme yönetimi için güvenli temel
          iskelet kuruldu.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/admin/login">
            Admin girişi
          </Link>
          <span className="status">İlk kurulum aşaması</span>
        </div>
      </section>
    </main>
  );
}
