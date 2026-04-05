import { type NextRequest } from "next/server"

export async function GET(_req: NextRequest): Promise<Response> {
  return new Response("pRrKIrTXKE78VxdVPjSi1U8mCepievMcsGXFIXJKB2E", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  })
}
