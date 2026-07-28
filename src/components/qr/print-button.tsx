"use client";

export function PrintButton() {
  return (
    <button
      className="button button-primary"
      onClick={() => window.print()}
      type="button"
    >
      Yazdır / PDF kaydet
    </button>
  );
}
