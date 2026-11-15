/** Cache only public scientific responses. No secrets or arbitrary upstream URLs. */
export async function cachedCutout(request: Request): Promise<Response | undefined> {
  if (typeof caches === 'undefined') return;
  return (caches as CacheStorage & { default: Cache }).default.match(request).catch(() => undefined);
}
export function storeCutout(
  request: Request,
  response: Response,
  waitUntil?: (work: Promise<unknown>) => void,
) {
  if (typeof caches === 'undefined' || !response.ok) return;
  const work = (caches as CacheStorage & { default: Cache }).default
    .put(request, response.clone())
    .catch(() => {});
  if (waitUntil) waitUntil(work);
  return work;
}
