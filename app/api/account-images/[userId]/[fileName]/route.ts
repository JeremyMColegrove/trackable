import { NextResponse } from "next/server"

import { readProfileImage } from "@/server/services/profile-image.service"

type RouteContext = {
  params: Promise<{
    fileName: string
    userId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { fileName, userId } = await context.params

  try {
    const imageBuffer = await readProfileImage({ fileName, userId })

    return new NextResponse(imageBuffer, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/webp",
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: "Profile image not found.",
      },
      {
        status: 404,
      }
    )
  }
}
