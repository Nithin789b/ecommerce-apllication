import { Router } from "express";
import { getPublicProduct, getPublicProducts } from "./product.controller.js";

const router = Router();

router.get("/", getPublicProducts);
router.get("/:productId", getPublicProduct);

export default router;
