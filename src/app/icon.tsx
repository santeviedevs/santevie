import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Placeholder favicon — same rationale as src/app/icons/[size]/route.tsx.
export default function Icon() {
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
        fontSize: 20,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      A
    </div>,
    size,
  );
}
