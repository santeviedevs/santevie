import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Placeholder apple touch icon — same rationale as
// src/app/icons/[size]/route.tsx.
export default function AppleIcon() {
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
        fontSize: 96,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      S
    </div>,
    size,
  );
}
