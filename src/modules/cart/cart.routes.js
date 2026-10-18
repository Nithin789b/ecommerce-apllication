import { Router } from "express";
import authenticateToken, { requireRole } from "../../middlewares/authentication.middleware.js";
import { addCartItem, clearMyCart, deleteCartItem, getMyCart, updateCartItem } from "./cart.controller.js";

const router = Router();
router.use(authenticateToken, requireRole("USER"));
router.get("/", getMyCart);
router.post("/items", addCartItem);
router.patch("/items/:productId", updateCartItem);
router.delete("/items/:productId", deleteCartItem);
router.delete("/", clearMyCart);

export default router;
