import QRCode from "qrcode";

export const QR_OPTIONS = {
  errorCorrectionLevel: "H" as const,
  margin: 2,
  width: 720,
};

export function qrPng(content: string) {
  return QRCode.toBuffer(content, {
    ...QR_OPTIONS,
    type: "png",
  });
}

export function qrSvg(content: string) {
  return QRCode.toString(content, {
    ...QR_OPTIONS,
    type: "svg",
  });
}

export function qrDataUrl(content: string) {
  return QRCode.toDataURL(content, QR_OPTIONS);
}
