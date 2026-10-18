import mongoose from "mongoose";
import Product from "../products/products.modal.js";
import { emitProductChange } from "../products/product-socket-events.js";
import { CheckoutError, cancelOrderForUser, changeOrderStatus, checkoutFromCart, countOrdersForUser, findOrderForUser, listAllOrders, listOrdersForUser } from "./order.service.js";

const isTransactionUnavailable = (error) =>
    error.code === 20 || /transaction numbers are only allowed/i.test(error.message ?? "");

const notifyOrderStockChanges = async (req, order) => {
    const io = req.app.get("io");
    if (!io || !order?.items?.length) return;
    try {
        const productIds = order.items.map((item) => item.product);
        const products = await Product.find({ _id: { $in: productIds } })
            .select("_id version stock isActive")
            .lean();
        for (const product of products) {
            emitProductChange(io, product, { stock: product.stock, isActive: product.isActive });
        }
    } catch (error) {
        // The database transaction already committed; a notification failure must not undo checkout.
        console.error("Product stock notification failed:", error.message);
    }
};

const pageOptions = (query) => {
    const page = Number.parseInt(query.page ?? "1", 10);
    const limit = Number.parseInt(query.limit ?? "20", 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return null;
    return { page, limit };
};

const isValidShippingAddress = (address) => {
    if (!address || typeof address !== "object" || Array.isArray(address)) return false;
    const requiredMaxLengths = {
        recipientName: 120,
        phone: 30,
        addressLine1: 200,
        city: 100,
        state: 100,
        postalCode: 20,
        country: 100
    };
    const requiredAreValid = Object.entries(requiredMaxLengths).every(([field, maxLength]) =>
        typeof address[field] === "string" && address[field].trim().length > 0 && address[field].trim().length <= maxLength
    );
    const optionalLine2IsValid = address.addressLine2 === undefined ||
        (typeof address.addressLine2 === "string" && address.addressLine2.length <= 200);
    return requiredAreValid && optionalLine2IsValid;
};

export const createOrder = async (req, res) => {
    const { shippingAddress, paymentMethod = "COD" } = req.body ?? {};
    const idempotencyKey = req.get("Idempotency-Key");
    if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
        return res.status(400).json({ success: false, message: "Provide an Idempotency-Key header containing 8 to 128 letters, numbers, dots, underscores, colons, or hyphens." });
    }
    if (!isValidShippingAddress(shippingAddress)) {
        return res.status(400).json({ success: false, message: "Provide recipientName, phone, addressLine1, city, state, postalCode, and country." });
    }
    if (paymentMethod !== "COD") {
        return res.status(400).json({ success: false, message: "Only cash on delivery (COD) is currently supported." });
    }
    try {
        const { order, replayed } = await checkoutFromCart(req.user.id, shippingAddress, idempotencyKey);
        if (!replayed) await notifyOrderStockChanges(req, order);
        return res.status(replayed ? 200 : 201).json({
            success: true,
            message: replayed ? "This checkout was already processed; returning its existing order." : "Order placed successfully.",
            order
        });
    } catch (error) {
        if (error instanceof CheckoutError) return res.status(error.status).json({ success: false, message: error.message });
        if (isTransactionUnavailable(error)) {
            return res.status(503).json({
                success: false,
                message: "Checkout transactions require MongoDB to run as a replica set. Configure a local replica set or use MongoDB Atlas."
            });
        }
        console.error("Create order error:", error);
        return res.status(500).json({ success: false, message: "Could not place order." });
    }
};

export const cancelMyOrder = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: "Invalid order ID." });
    try {
        const order = await cancelOrderForUser(req.params.orderId, req.user.id);
        await notifyOrderStockChanges(req, order);
        return res.status(200).json({ success: true, message: "Order cancelled and stock restored.", order });
    } catch (error) {
        if (error instanceof CheckoutError) return res.status(error.status).json({ success: false, message: error.message });
        if (isTransactionUnavailable(error)) {
            return res.status(503).json({ success: false, message: "Order cancellation requires MongoDB to run as a replica set." });
        }
        console.error("Cancel order error:", error);
        return res.status(500).json({ success: false, message: "Could not cancel order." });
    }
};

export const getMyOrders = async (req, res) => {
    const pagination = pageOptions(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Page must be positive; limit must be between 1 and 100." });
    try {
        const [items, total] = await Promise.all([
            listOrdersForUser(req.user.id, pagination.page, pagination.limit),
            countOrdersForUser(req.user.id)
        ]);
        return res.status(200).json({ success: true, items, total, ...pagination, pages: Math.ceil(total / pagination.limit) });
    } catch (error) {
        console.error("List my orders error:", error);
        return res.status(500).json({ success: false, message: "Could not load orders." });
    }
};

export const getMyOrder = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: "Invalid order ID." });
    try {
        const order = await findOrderForUser(req.params.orderId, req.user.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });
        return res.status(200).json({ success: true, order });
    } catch (error) {
        console.error("Get order error:", error);
        return res.status(500).json({ success: false, message: "Could not load order." });
    }
};

export const getAdminOrders = async (req, res) => {
    const pagination = pageOptions(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Page must be positive; limit must be between 1 and 100." });
    const status = req.query.status;
    const validStatuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: "Invalid order status filter." });
    try {
        const result = await listAllOrders({ status, ...pagination });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error("Admin list orders error:", error);
        return res.status(500).json({ success: false, message: "Could not load orders." });
    }
};

export const updateAdminOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body ?? {};
    if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ success: false, message: "Invalid order ID." });
    if (!status || !["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(status)) {
        return res.status(400).json({ success: false, message: "Provide a valid next order status." });
    }
    try {
        const order = await changeOrderStatus(orderId, status);
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });
        if (status === "CANCELLED") await notifyOrderStockChanges(req, order);
        return res.status(200).json({ success: true, message: "Order status updated.", order });
    } catch (error) {
        if (error instanceof CheckoutError) return res.status(error.status).json({ success: false, message: error.message });
        if (isTransactionUnavailable(error)) {
            return res.status(503).json({ success: false, message: "Order cancellation requires MongoDB to run as a replica set." });
        }
        console.error("Update order status error:", error);
        return res.status(500).json({ success: false, message: "Could not update order status." });
    }
};
