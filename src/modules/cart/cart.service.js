import Cart from "./cart.model.js";

export const findCartForUser = (userId) => Cart.findOne({ user: userId })
    .populate("items.product", "name price images stock isActive sku category")
    .lean();

export const getOrCreateCart = async (userId) => {
    try {
        return await Cart.findOneAndUpdate(
            { user: userId },
            { $setOnInsert: { user: userId, items: [] } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        // A concurrent first request may win the unique user index race.
        if (error.code === 11000) return Cart.findOne({ user: userId });
        throw error;
    }
};

export const saveCart = (cart) => cart.save();
export const removeCartItem = (userId, productId) =>
    Cart.findOneAndUpdate({ user: userId }, { $pull: { items: { product: productId } } }, { new: true });
export const emptyCart = (userId) =>
    Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } }, { new: true });
