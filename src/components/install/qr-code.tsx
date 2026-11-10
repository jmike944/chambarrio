import QRCode from "qrcode";

/**
 * A QR code as inline SVG, drawn on the server (no client JavaScript). Dark on white with a 4-module
 * quiet zone, so any phone camera reads it.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const q = 4;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) d += `M${x + q} ${y + q}h1v1h-1z`;
    }
  }
  const size = n + q * 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" className={className}>
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#160f33" />
    </svg>
  );
}
