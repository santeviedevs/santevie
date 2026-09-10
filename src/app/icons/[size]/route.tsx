import { ImageResponse } from "next/og";

// Placeholder brand icon, generated on demand rather than checked in as a
// binary asset — swap for a real designed icon set when one is available;
// only the manifest's src values (see src/app/manifest.ts) need to change.
const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = ALLOWED_SIZES.has(Number(sizeParam)) ? Number(sizeParam) : 192;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#09090b",
        color: "#fafafa",
        fontSize: size * 0.42,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      S
    </div>,
    { width: size, height: size },
  );
}
