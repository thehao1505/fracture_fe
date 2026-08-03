import { encodeQr, qrPath } from "@/lib/qr";

/**
 * Server-rendered QR for the profile URL. Always drawn dark-on-white with the
 * spec's 4-module quiet zone, regardless of the page theme — scanners want
 * the contrast, and a themed QR is a QR that sometimes doesn't scan.
 */
export function QrCode({ value, size = 176 }: { value: string; size?: number }) {
  const matrix = encodeQr(value);
  if (!matrix) return null;

  const quiet = 4;
  const extent = matrix.size + quiet * 2;

  return (
    <svg
      viewBox={`${-quiet} ${-quiet} ${extent} ${extent}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${value}`}
      className="rounded-xl bg-white"
    >
      <rect
        x={-quiet}
        y={-quiet}
        width={extent}
        height={extent}
        fill="#ffffff"
      />
      <path d={qrPath(matrix)} fill="#18181b" />
    </svg>
  );
}
