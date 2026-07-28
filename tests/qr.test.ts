import { describe, expect, it } from "vitest";
import {
  createStoredQrToken,
  decryptQrToken,
  generateQrToken,
  hashQrToken,
} from "../src/features/qr/crypto";
import {
  publicQrTokenSchema,
  tableSchema,
} from "../src/features/qr/validation";
import { qrPng, qrSvg } from "../src/features/qr/image";

const secret = "phase-four-test-secret-that-is-long-enough";

describe("QR token security", () => {
  it("creates unpredictable, URL-safe 256-bit tokens", () => {
    const tokens = Array.from({ length: 128 }, () => generateQrToken());
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.every((token) => publicQrTokenSchema.safeParse(token).success))
      .toBe(true);
  });

  it("stores a hash and authenticated ciphertext without exposing raw token", () => {
    const qr = createStoredQrToken(secret);
    expect(qr.hash).toBe(hashQrToken(qr.token));
    expect(qr.hash).not.toContain(qr.token);
    expect(qr.encrypted).not.toContain(qr.token);
    expect(decryptQrToken(qr.encrypted, secret)).toBe(qr.token);
  });

  it("rejects ciphertext tampering and a different encryption secret", () => {
    const qr = createStoredQrToken(secret);
    const replacement = qr.encrypted.endsWith("A") ? "B" : "A";
    const tampered = `${qr.encrypted.slice(0, -1)}${replacement}`;
    expect(() => decryptQrToken(tampered, secret)).toThrow();
    expect(() =>
      decryptQrToken(
        qr.encrypted,
        "another-test-secret-that-is-long-enough",
      ),
    ).toThrow();
  });

  it("makes an old token hash different after rotation", () => {
    const oldQr = createStoredQrToken(secret);
    const newQr = createStoredQrToken(secret);
    expect(newQr.hash).not.toBe(oldQr.hash);
    expect(hashQrToken(oldQr.token)).not.toBe(newQr.hash);
  });
});

describe("table input validation", () => {
  it("accepts valid table data", () => {
    expect(
      tableSchema.parse({
        number: "21",
        name: "Bahçe 1",
        sortOrder: "21",
        isActive: "on",
      }),
    ).toMatchObject({
      number: 21,
      name: "Bahçe 1",
      sortOrder: 21,
      isActive: true,
    });
  });

  it("rejects invalid numbers and oversized names", () => {
    expect(
      tableSchema.safeParse({
        number: "0",
        name: "x".repeat(81),
        sortOrder: "-1",
      }).success,
    ).toBe(false);
  });
});

describe("QR image generation", () => {
  it("creates downloadable PNG and SVG payloads", async () => {
    const content = `https://example.com/menu/t/${generateQrToken()}`;
    const png = await qrPng(content);
    const svg = await qrSvg(content);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<script");
  });
});
