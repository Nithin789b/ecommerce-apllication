import mongoose from "mongoose";
import Cart from "../cart/cart.model.js";
import Product from "../products/products.modal.js";
import Order from "./order.model.js";

export class CheckoutError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const money = (value) => Number(value.toFixed(2));

export const checkoutFromCart = async (userId, shippingAddress, idempotencyKey) => {
    const session = await mongoose.startSession();
    let createdOrder;
    let replayed = false;
    try {
        await session.withTransaction(async () => {
            const priorOrder = await Order.findOne({ user: userId, idempotencyKey }).session(session);
            if (priorOrder) {
                createdOrder = priorOrder;
                replayed = true;
                return;
            }

            const cart = await Cart.findOne({ user: userId }).session(session).lean();
            if (!cart?.items?.length) throw new CheckoutError(400, "Your cart is empty.");

            const productIds = cart.items.map((item) => item.product);
            const products = await Product.find({ _id: { $in: productIds }, isActive: true })
                .session(session)
                .lean();
            const productById = new Map(products.map((product) => [product._id.toString(), product]));
            const items = [];

            // Keep these writes sequential. Each stock reservation is conditional and part of this transaction.
            for (const cartItem of cart.items) {
                const product = productById.get(cartItem.product.toString());
                if (!product) {
                    throw new CheckoutError(409, "A product in your cart is no longer available. Refresh your cart and try again.");
                }
                if (cartItem.quantity > product.stock) {
                    throw new CheckoutError(409, `${product.name} has only ${product.stock} item(s) left in stock.`);
                }

                const reservation = await Product.updateOne(
                    { _id: product._id, isActive: true, stock: { $gte: cartItem.quantity } },
                    { $inc: { stock: -cartItem.quantity, version: 1 } },
                    { session }
                );
                if (reservation.modifiedCount !== 1) {
                    throw new CheckoutError(409, `${product.name} no longer has enough stock. Refresh your cart and try again.`);
                }

                const unitPrice = money(product.price);
                items.push({
                    product: product._id,
                    name: product.name,
                    sku: product.sku,
                    image: product.images?.[0] ?? null,
                    unitPrice,
                    quantity: cartItem.quantity,
                    lineTotal: money(unitPrice * cartItem.quantity)
                });
            }

            const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
            const [order] = await Order.create([{
                user: userId,
                idempotencyKey,
                items,
                shippingAddress,
                subtotal,
                shippingFee: 0,
                total: subtotal,
                paymentMethod: "COD",
                paymentStatus: "PENDING",
                status: "PENDING"
            }], { session });

            await Cart.updateOne({ user: userId }, { $set: { items: [] } }, { session });
            createdOrder = order;
            replayed = false;
        });

        return { order: createdOrder, replayed };
    } catch (error) {
        // A concurrent retry can pass the initial lookup; the unique index makes one request win.
        if (error.code === 11000) {
            const priorOrder = await Order.findOne({ user: userId, idempotencyKey }).lean();
            if (priorOrder) return { order: priorOrder, replayed: true };
        }
        throw error;
    } finally {
        await session.endSession();
    }
};

const restoreOrderStock = async (order, session) => {
    for (const item of order.items) {
        const result = await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity, version: 1 } },
            { session }
        );
        if (result.modifiedCount !== 1) {
            throw new CheckoutError(409, `Could not restore stock for ${item.name}; the order was not cancelled.`);
        }
    }
};

export const cancelOrderForUser = async (orderId, userId) => {
    const session = await mongoose.startSession();
    let cancelledOrder;
    try {
        await session.withTransaction(async () => {
            const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
            if (!order) throw new CheckoutError(404, "Order not found.");
            if (order.status !== "PENDING") {
                throw new CheckoutError(409, "Only pending orders can be cancelled by the customer.");
            }

            const result = await Order.updateOne(
                { _id: orderId, user: userId, status: "PENDING" },
                { $set: { status: "CANCELLED" } },
                { session }
            );
            if (result.modifiedCount !== 1) throw new CheckoutError(409, "The order status changed; refresh and try again.");
            await restoreOrderStock(order, session);
            cancelledOrder = await Order.findById(orderId).session(session);
        });
        return cancelledOrder;
    } finally {
        await session.endSession();
    }
};

export const listOrdersForUser = (userId, page, limit) => Order.find({ user: userId })
    .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();

export const countOrdersForUser = (userId) => Order.countDocuments({ user: userId });
export const findOrderForUser = (orderId, userId) => Order.findOne({ _id: orderId, user: userId }).lean();

export const listAllOrders = async ({ status, page, limit }) => {
    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Order.countDocuments(filter)
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

const allowedNextStatus = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: []
};

export const changeOrderStatus = async (orderId, nextStatus) => {
    if (nextStatus === "CANCELLED") {
        const session = await mongoose.startSession();
        let cancelledOrder;
        try {
            await session.withTransaction(async () => {
                const order = await Order.findById(orderId).session(session);
                if (!order) return;
                if (!allowedNextStatus[order.status]?.includes(nextStatus)) {
                    throw new CheckoutError(400, `Order cannot move from ${order.status} to ${nextStatus}.`);
                }
                const result = await Order.updateOne(
                    { _id: orderId, status: order.status },
                    { $set: { status: "CANCELLED" } },
                    { session }
                );
                if (result.modifiedCount !== 1) throw new CheckoutError(409, "The order status changed. Reload the order and try again.");
                await restoreOrderStock(order, session);
                cancelledOrder = await Order.findById(orderId).session(session);
            });
            return cancelledOrder;
        } finally {
            await session.endSession();
        }
    }

    const order = await Order.findById(orderId);
    if (!order) return null;
    if (!allowedNextStatus[order.status]?.includes(nextStatus)) {
        throw new CheckoutError(400, `Order cannot move from ${order.status} to ${nextStatus}.`);
    }
    const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, status: order.status },
        { $set: { status: nextStatus } },
        { new: true, runValidators: true }
    );
    if (!updatedOrder) throw new CheckoutError(409, "The order status changed. Reload the order and try again.");
    return updatedOrder;
};
