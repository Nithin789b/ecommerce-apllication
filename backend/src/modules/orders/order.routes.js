import { Router } from "express";
import authenticateToken, { requireRole } from "../../middlewares/authentication.middleware.js";
import { cancelMyOrder, createOrder, getMyOrder, getMyOrders } from "./order.controller.js";

const router = Router();
router.use(authenticateToken, requireRole("USER"));
router.post("/", createOrder);
router.post("/:orderId/cancel", cancelMyOrder);
router.get("/", getMyOrders);
router.get("/:orderId", getMyOrder);

export default router;
