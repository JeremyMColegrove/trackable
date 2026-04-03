import { NextResponse } from "next/server"

import { getPublicAppConfig } from "@/lib/public-app-config"

export async function GET() {
  return NextResponse.json(getPublicAppConfig(), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
