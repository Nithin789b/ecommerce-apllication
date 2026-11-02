/**
 * Prevent storage of potentially sensitive or user-specific API responses.
 * no-store also disables cache reuse, including browser and shared proxy caches.
 */
export const noStore = (req, res, next) => {
    res.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    next();
};

/**
 * Let browsers revalidate every time, while allowing shared caches (such as a
 * CDN) to retain public catalog responses briefly. Express ETags can answer
 * revalidation requests with 304 Not Modified when the response is unchanged.
 */
export const cachePublicCatalog = (req, res, next) => {
    res.set("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=30");
    next();
};
