import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

// Usage: call this in a product page and pass its state setter.
// Install socket.io-client in the React application, not in this backend package.
export function useProductLiveUpdates({ productId, accessToken, setProduct }) {
    const latestVersion = useRef(0);

    useEffect(() => {
        if (!productId || !accessToken) return undefined;

        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const socket = io(apiUrl, { auth: { token: accessToken }, reconnection: true });

        const refreshProduct = async () => {
            const response = await fetch(`${apiUrl}/api/products/${productId}`);
            const body = await response.json();
            if (response.ok && body.success) {
                latestVersion.current = body.product.version ?? 1;
                setProduct(body.product);
                socket.emit("product:subscribe", { productId }, (ack) => {
                    if (!ack?.success) console.warn("Product subscription failed:", ack?.message);
                });
            }
        };

        const onProductUpdated = (event) => {
            if (event.productId !== productId || event.version <= latestVersion.current) return;
            latestVersion.current = event.version;
            setProduct((current) => {
                if (!current) return current;
                const next = { ...current, ...event.changes };
                if (event.changes.status) next.isActive = event.changes.status === "ACTIVE";
                return next;
            });
        };

        const onProductUnavailable = (event) => {
            if (event.productId !== productId || event.version <= latestVersion.current) return;
            latestVersion.current = event.version;
            setProduct((current) => current ? {
                ...current,
                isActive: event.status === "ACTIVE",
                stock: event.reason === "OUT_OF_STOCK" ? 0 : current.stock
            } : current);
        };

        socket.on("connect", refreshProduct);
        socket.on("product:updated", onProductUpdated);
        socket.on("product:unavailable", onProductUnavailable);

        return () => {
            socket.emit("product:unsubscribe", { productId });
            socket.off("connect", refreshProduct);
            socket.off("product:updated", onProductUpdated);
            socket.off("product:unavailable", onProductUnavailable);
            socket.disconnect();
        };
    }, [productId, accessToken, setProduct]);
}
