import mongoose from "mongoose";
import { findPublicProductById } from "../modules/products/product.service.js";
import { productRoom } from "../modules/products/product-socket-events.js";

export const registerProductSocketHandlers = (io) => {
    io.on("connection", (socket) => {
        socket.on("product:subscribe", async (payload = {}, acknowledge) => {
            const reply = typeof acknowledge === "function" ? acknowledge : () => {};
            const { productId } = payload;
            if (!mongoose.isValidObjectId(productId)) {
                return reply({ success: false, code: "INVALID_PRODUCT_ID", message: "A valid productId is required." });
            }

            try {
                const product = await findPublicProductById(productId);
                if (!product) {
                    return reply({ success: false, code: "PRODUCT_UNAVAILABLE", message: "Product is unavailable." });
                }
                const joinedProductRooms = [...socket.rooms].filter((room) => room.startsWith("product:")).length;
                if (!socket.rooms.has(productRoom(productId)) && joinedProductRooms >= 20) {
                    return reply({ success: false, code: "ROOM_LIMIT", message: "A connection can subscribe to at most 20 products." });
                }
                await socket.join(productRoom(productId));
                return reply({ success: true, productId, version: product.version ?? 1 });
            } catch (error) {
                console.error("Product socket subscription error:", error.message);
                return reply({ success: false, code: "SUBSCRIBE_FAILED", message: "Could not subscribe to product updates." });
            }
        });

        socket.on("product:unsubscribe", async (payload = {}, acknowledge) => {
            const reply = typeof acknowledge === "function" ? acknowledge : () => {};
            const { productId } = payload;
            if (!mongoose.isValidObjectId(productId)) {
                return reply({ success: false, code: "INVALID_PRODUCT_ID", message: "A valid productId is required." });
            }
            await socket.leave(productRoom(productId));
            return reply({ success: true, productId });
        });
    });
};
