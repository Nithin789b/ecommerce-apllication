import Product from "./products.modal.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createProduct = (productData) => Product.create(productData);

export const updateProductById = (productId, updates) =>
    Product.findByIdAndUpdate(productId, { $set: updates, $inc: { version: 1 } }, { new: true, runValidators: true });

export const listPublicProducts = async ({ search, category, page, limit }) => {
    const filter = { isActive: true };
    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
    if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        filter.$or = [{ name: pattern }, { description: pattern }];
    }

    const [items, total] = await Promise.all([
        Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Product.countDocuments(filter)
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

export const findPublicProductById = (productId) =>
    Product.findOne({ _id: productId, isActive: true }).lean();
