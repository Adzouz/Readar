/** Runs `work` over `items` with at most `size` in flight. Results keep the input order. */
export async function pool<T, R>(
  items: T[],
  size: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await work(items[index] as T)
      }
    }),
  )
  return results
}
