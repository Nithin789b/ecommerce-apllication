import { Router } from "express";
import { getPublicProduct, getPublicProducts } from "./product.controller.js";
import { cachePublicCatalog } from "../../middlewares/cache-control.middleware.js";

const router = Router();

// Catalog data is public. Shared caches may keep it for 60 seconds; clients
// revalidate through Express ETags, and stale content is allowed for 30 seconds
// while a shared cache refreshes in the background.
router.get("/", cachePublicCatalog, getPublicProducts);
router.get("/:productId", cachePublicCatalog, getPublicProduct);

export default router;
