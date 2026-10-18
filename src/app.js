import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import userRoutes from "./modules/users/user.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import productRoutes from "./modules/products/product.routes.js";
import cartRoutes from "./modules/cart/cart.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";

const app = express();


app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));

app.use(cookieParser());
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "E-commerce backend is running"
    });
});

export default app;
