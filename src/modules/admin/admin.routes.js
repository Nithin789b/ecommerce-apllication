import { Router } from "express";
import authenticateToken, { requireRole } from "../../middlewares/authentication.middleware.js";
import { getCurrentUser } from "../users/user.controller.js";
import { createAdminProduct, updateAdminProduct, updateAdminProductStatus, updateAdminProductStock } from "../products/product.controller.js";
import { parseProductImageFiles } from "../products/product-image-upload.middleware.js";
import { getAdminOrders, updateAdminOrderStatus } from "../orders/order.controller.js";

const router = Router();

router.get("/me", authenticateToken, requireRole("ADMIN"), getCurrentUser);
router.get("/orders", authenticateToken, requireRole("ADMIN"), getAdminOrders);
router.patch("/orders/:orderId/status", authenticateToken, requireRole("ADMIN"), updateAdminOrderStatus);
router.post("/products", authenticateToken, requireRole("ADMIN"), parseProductImageFiles, createAdminProduct);
router.patch("/products/:productId", authenticateToken, requireRole("ADMIN"), parseProductImageFiles, updateAdminProduct);
router.patch("/products/:productId/stock", authenticateToken, requireRole("ADMIN"), updateAdminProductStock);
router.patch("/products/:productId/status", authenticateToken, requireRole("ADMIN"), updateAdminProductStatus);

export default router;
