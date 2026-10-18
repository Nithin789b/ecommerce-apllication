export const productRoom = (productId) => `product:${productId}`;

const publicProductChanges = (changes) => {
    const safe = {};
    for (const field of ["name", "description", "price", "category", "images", "stock"]) {
        if (Object.hasOwn(changes, field)) safe[field] = changes[field];
    }
    if (Object.hasOwn(changes, "isActive")) {
        safe.status = changes.isActive ? "ACTIVE" : "INACTIVE";
    }
    return safe;
};

export const emitProductChange = (io, product, changes) => {
    if (!io || !product?._id) return;
    const productId = product._id.toString();
    const payload = {
        productId,
        version: product.version,
        changes: publicProductChanges(changes)
    };
    const room = productRoom(productId);

    if (changes.isActive === false) {
        io.to(room).emit("product:unavailable", { productId, version: product.version, reason: "INACTIVE", status: "INACTIVE" });
    } else if (Object.hasOwn(changes, "stock") && product.stock === 0) {
        io.to(room).emit("product:unavailable", { productId, version: product.version, reason: "OUT_OF_STOCK", status: "ACTIVE" });
    } else {
        io.to(room).emit("product:updated", payload);
    }
};
