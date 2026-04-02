import assert from "node:assert/strict"
import test from "node:test"

import { buildYouTubeEmbedUrl, extractYouTubeVideoId } from "@/lib/youtube"

test("extractYouTubeVideoId supports common youtube url formats", () => {
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  )
  assert.equal(
    extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=demo"),
    "dQw4w9WgXcQ"
  )
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  )
})

test("buildYouTubeEmbedUrl rejects non-video urls", () => {
  assert.equal(buildYouTubeEmbedUrl("https://example.com/video"), null)
  assert.equal(
    buildYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  )
})
