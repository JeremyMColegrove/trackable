const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/

function normalizeVideoId(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  const [videoId] = trimmed.split(/[/?&#]/)

  return videoId && youtubeVideoIdPattern.test(videoId) ? videoId : null
}

export function extractYouTubeVideoId(value: string) {
  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase()

    if (hostname === "youtu.be") {
      return normalizeVideoId(url.pathname.slice(1))
    }

    if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname === "youtube-nocookie.com" ||
      hostname === "www.youtube-nocookie.com"
    ) {
      if (url.pathname === "/watch") {
        return normalizeVideoId(url.searchParams.get("v"))
      }

      if (
        url.pathname.startsWith("/embed/") ||
        url.pathname.startsWith("/shorts/") ||
        url.pathname.startsWith("/live/")
      ) {
        return normalizeVideoId(url.pathname.split("/")[2])
      }
    }
  } catch {
    return null
  }

  return null
}

export function buildYouTubeEmbedUrl(value: string) {
  const videoId = extractYouTubeVideoId(value)

  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
}
