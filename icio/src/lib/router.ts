/** Hash routing. The site is static, so every view must be reachable from a URL alone. */

export type RouteName =
  | 'overview'
  | 'economies'
  | 'services'
  | 'growth'
  | 'industries'
  | 'method'

export const ROUTES: { name: RouteName; hash: string; label: string }[] = [
  { name: 'overview', hash: '#/', label: 'Overview' },
  { name: 'economies', hash: '#/economies', label: 'Economies' },
  { name: 'services', hash: '#/services', label: 'Services behind manufacturing' },
  { name: 'growth', hash: '#/growth', label: 'Prices versus volume' },
  { name: 'industries', hash: '#/industries', label: 'Inside manufacturing' },
  { name: 'method', hash: '#/method', label: 'Method' },
]

export interface RouteInfo {
  route: RouteName
  params: URLSearchParams
  /** Present only on `#/embed/...` routes, which render without the full chrome. */
  embed: string | null
}

export function parseHash(hash: string): RouteInfo {
  const clean = hash.replace(/^#\/?/, '')
  const [pathPart = '', queryPart = ''] = clean.split('?')
  const params = new URLSearchParams(queryPart)
  const segments = pathPart.split('/').filter(Boolean)

  if (segments[0] === 'embed') {
    return { route: 'overview', params, embed: segments[1] ?? 'world' }
  }

  const name = (segments[0] ?? '') as RouteName
  const known = ROUTES.some((entry) => entry.name === name)
  return { route: known ? name : 'overview', params, embed: null }
}

/** Build a hash for a route, carrying selection through so links restore what the reader saw. */
export function buildHash(
  route: RouteName,
  params: Record<string, string | number | null | undefined>,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  const base = ROUTES.find((entry) => entry.name === route)?.hash ?? '#/'
  return query ? `${base}?${query}` : base
}

export function buildEmbedHash(
  embed: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `#/embed/${embed}?${query}` : `#/embed/${embed}`
}

/** Parse a comma-separated economy list, dropping blanks and duplicates. */
export function parseList(value: string | null): string[] {
  if (!value) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of value.split(',')) {
    const code = part.trim().toUpperCase()
    if (code && !seen.has(code)) {
      seen.add(code)
      out.push(code)
    }
  }
  return out
}

/** Keep URL selections inside the rows that the current year can actually display. */
export function parseAllowedList(
  value: string | null,
  allowed: string[],
  fallback: string[],
  max = Infinity,
): string[] {
  const allowedSet = new Set(allowed)
  const selected = parseList(value).filter((code) => allowedSet.has(code)).slice(0, max)
  if (selected.length > 0) return selected
  return fallback.filter((code) => allowedSet.has(code)).slice(0, max)
}

export function parseYear(value: string | null, allowed: number[], fallback: number): number {
  const parsed = Number(value)
  return allowed.includes(parsed) ? parsed : fallback
}
