import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import userRoutes from "./modules/users/user.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import productRoutes from "./modules/products/product.routes.js";
import cartRoutes from "./modules/cart/cart.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import { noStore } from "./middlewares/cache-control.middleware.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));

app.use(cookieParser());
// User, admin, cart, and order responses can contain personal or changing data;
// prevent browsers and shared proxies from storing these API responses.
app.use("/api/users", noStore, userRoutes);
app.use("/api/admin", noStore, adminRoutes);
app.use("/api/cart", noStore, cartRoutes);
app.use("/api/orders", noStore, orderRoutes);
// Public product routes apply their own short-lived cache policy.
app.use("/api/products", productRoutes);

app.get("/api/health", noStore, (req, res) => {
    res.json({
        success: true,
        message: "E-commerce backend is running"
    });
});

export default app;
