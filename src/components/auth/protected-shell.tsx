import type { ReactNode } from "react";
import type { UserRole } from "@prisma/client";
import { logoutAction } from "@/app/auth-actions";

type ProtectedShellProps = {
  title: string;
  name: string;
  role: UserRole;
  children: ReactNode;
};

export function ProtectedShell({
  title,
  name,
  role,
  children,
}: ProtectedShellProps) {
  return (
    <main className="page-shell">
      <section className="login-card" aria-labelledby="protected-title">
        <p className="eyebrow">Güvenli çalışma alanı</p>
        <h1 id="protected-title">{title}</h1>
        <p className="muted">
          {name} · {role}
        </p>
        <div className="protected-content">{children}</div>
        <form action={logoutAction}>
          <button className="button button-secondary" type="submit">
            Güvenli çıkış
          </button>
        </form>
      </section>
    </main>
  );
}
