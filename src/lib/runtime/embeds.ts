/**
 * Only YouTube and Vimeo can be embedded, and only after the URL has been
 * reduced to an id that we build the iframe src from ourselves.
 *
 * An owner therefore cannot point an iframe at an arbitrary origin: no
 * third-party frame runs on a visitor's page unless the platform allows that
 * host here explicitly.
 */
export function embedSrc(raw: string): string | null {
  let url: URL

  try {
    url = new URL(raw)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).pop()
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1)
    return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).pop()
    return id && /^\d{5,12}$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
  }

  return null
}
