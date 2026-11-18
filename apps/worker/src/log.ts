const stamp = (): string => new Date().toISOString().slice(11, 19)

// Actions logs of a public repo are public (PLAN.md §11): never log what a user added (link URLs
// or hosts, keywords, article URLs from their feeds). Log row ids instead.
export const log = {
  info: (message: string): void => console.log(`${stamp()} ${message}`),
  warn: (message: string): void => console.warn(`${stamp()} ! ${message}`),
}

/**
 * Safe name for a source in the logs: catalog slugs are public; user links have no slug, and
 * keyword search slugs (`gnews:<keyword>`) reveal what a user watches, so those show their id.
 */
export const sourceLabel = (source: { id: string; slug: string | null; kind: string }): string =>
  source.slug && source.kind !== 'search' ? source.slug : `${source.kind} #${source.id}`
