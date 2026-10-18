import { Router } from "express";
import authenticateToken, { requireRole } from "../../middlewares/authentication.middleware.js";
import { signupUser, loginUser, loginAdmin, refreshSession, logoutUser, getCurrentUser } from "./user.controller.js";

const router = Router();

router.post("/signup", signupUser);
router.post("/login", loginUser);
router.post("/admin/login", loginAdmin);
router.post("/refresh", refreshSession);
router.post("/logout", logoutUser);
router.get("/me", authenticateToken, requireRole("USER"), getCurrentUser);

export default router;
