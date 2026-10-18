import mongoose from "mongoose";
import Product from "../products/products.modal.js";
import { emptyCart, findCartForUser, getOrCreateCart, removeCartItem, saveCart } from "./cart.service.js";

const validQuantity = (value) => Number.isInteger(value) && value > 0;

const cartResponse = (cart) => ({
    success: true,
    cart: {
        items: (cart?.items ?? []).map(({ product, quantity }) => ({
            product: product ? {
                _id: product._id,
                name: product.name,
                sku: product.sku,
                category: product.category,
                price: product.price,
                images: product.images,
                stock: product.stock,
                isActive: product.isActive
            } : null,
            quantity,
            lineTotal: product ? Number((product.price * quantity).toFixed(2)) : null
        }))
    }
});

export const getMyCart = async (req, res) => {
    try {
        return res.status(200).json(cartResponse(await findCartForUser(req.user.id)));
    } catch (error) {
        console.error("Get cart error:", error);
        return res.status(500).json({ success: false, message: "Could not load cart." });
    }
};

export const addCartItem = async (req, res) => {
    const { productId, quantity = 1 } = req.body ?? {};
    if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ success: false, message: "A valid productId is required." });
    }
    if (!validQuantity(quantity)) {
        return res.status(400).json({ success: false, message: "Quantity must be a positive whole number." });
    }

    try {
        const product = await Product.findOne({ _id: productId, isActive: true }).select("stock").lean();
        if (!product) return res.status(404).json({ success: false, message: "Active product not found." });
        const cart = await getOrCreateCart(req.user.id);
        const existing = cart.items.find((item) => item.product.toString() === productId);
        const nextQuantity = (existing?.quantity ?? 0) + quantity;
        if (nextQuantity > product.stock) {
            return res.status(409).json({ success: false, message: `Only ${product.stock} item(s) are currently in stock.` });
        }
        if (existing) existing.quantity = nextQuantity;
        else cart.items.push({ product: productId, quantity });
        await saveCart(cart);
        return res.status(200).json(cartResponse(await findCartForUser(req.user.id)));
    } catch (error) {
        console.error("Add cart item error:", error);
        return res.status(500).json({ success: false, message: "Could not add item to cart." });
    }
};

export const updateCartItem = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body ?? {};
    if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID." });
    }
    if (!validQuantity(quantity)) {
        return res.status(400).json({ success: false, message: "Quantity must be a positive whole number." });
    }

    try {
        const product = await Product.findOne({ _id: productId, isActive: true }).select("stock").lean();
        if (!product) return res.status(404).json({ success: false, message: "Active product not found." });
        if (quantity > product.stock) {
            return res.status(409).json({ success: false, message: `Only ${product.stock} item(s) are currently in stock.` });
        }
        const cart = await getOrCreateCart(req.user.id);
        const item = cart.items.find((entry) => entry.product.toString() === productId);
        if (!item) return res.status(404).json({ success: false, message: "Product is not in your cart." });
        item.quantity = quantity;
        await saveCart(cart);
        return res.status(200).json(cartResponse(await findCartForUser(req.user.id)));
    } catch (error) {
        console.error("Update cart item error:", error);
        return res.status(500).json({ success: false, message: "Could not update cart item." });
    }
};

export const deleteCartItem = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID." });
    }
    try {
        await removeCartItem(req.user.id, req.params.productId);
        return res.status(200).json(cartResponse(await findCartForUser(req.user.id)));
    } catch (error) {
        console.error("Remove cart item error:", error);
        return res.status(500).json({ success: false, message: "Could not remove cart item." });
    }
};

export const clearMyCart = async (req, res) => {
    try {
        await emptyCart(req.user.id);
        return res.status(200).json(cartResponse(await findCartForUser(req.user.id)));
    } catch (error) {
        console.error("Clear cart error:", error);
        return res.status(500).json({ success: false, message: "Could not clear cart." });
    }
};
