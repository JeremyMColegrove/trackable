import { ImageResponse } from "next/og"

import { siteConfig } from "@/lib/site-config"

export const alt = `${siteConfig.name} preview`
export const contentType = "image/png"
export const size = {
  width: 1200,
  height: 630,
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        color: "#0f172a",
        fontFamily: "sans-serif",
        padding: "64px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
          border: "1px solid #cbd5e1",
          borderRadius: "32px",
          background: "rgba(255, 255, 255, 0.82)",
          padding: "56px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "36px",
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            display: "flex",
            maxWidth: "900px",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "74px",
              fontWeight: 700,
              letterSpacing: "-0.06em",
              lineHeight: 1.02,
            }}
          >
            {siteConfig.homeHeading}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: "840px",
              fontSize: "32px",
              lineHeight: 1.35,
              color: "#334155",
            }}
          >
            {siteConfig.homeSummary}
          </div>
        </div>
      </div>
    </div>,
    size
  )
}
