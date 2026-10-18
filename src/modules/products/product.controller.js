import mongoose from "mongoose";
import {
    createProduct,
    findPublicProductById,
    listPublicProducts,
    updateProductById
} from "./product.service.js";
import { uploadProductImages, deleteProductImages } from "./product-image.service.js";
import { emitProductChange } from "./product-socket-events.js";

const editableProductFields = new Set(["name", "description", "price", "category", "sku", "images", "stock"]);

const parseNumber = (value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim()) return Number(value);
    return Number.NaN;
};

const isCloudinaryConfigurationError = (error) => error.name === "CloudinaryConfigurationError";
const isCloudinaryTimeoutError = (error) => error.name === "TimeoutError" || error.http_code === 499;
const isCloudinaryConnectionError = (error) => ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(error.code);

const cloudinaryUploadFailure = (error) => {
    if (isCloudinaryConfigurationError(error)) {
        return { status: 503, message: error.message };
    }
    if (isCloudinaryTimeoutError(error)) {
        return {
            status: 504,
            message: "Cloudinary took too long to receive the image. Try again with a smaller image or check your internet connection."
        };
    }
    if (isCloudinaryConnectionError(error)) {
        return {
            status: 502,
            message: "The connection to Cloudinary was interrupted. Check the server's internet, VPN, or firewall, then retry."
        };
    }
    return { status: 502, message: "Image upload failed. Please try again." };
};

export const createAdminProduct = async (req, res) => {
    const { name, description, category, sku } = req.body ?? {};
    const price = parseNumber(req.body?.price);
    const stock = req.body?.stock === undefined ? 0 : parseNumber(req.body.stock);

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
        return res.status(400).json({ success: false, message: "Name must be 2 to 120 characters." });
    }
    if (typeof description !== "string" || !description.trim() || description.trim().length > 5000) {
        return res.status(400).json({ success: false, message: "Description is required and cannot exceed 5000 characters." });
    }
    if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: "Price must be a non-negative number." });
    }
    if (typeof category !== "string" || !category.trim() || category.trim().length > 80) {
        return res.status(400).json({ success: false, message: "Category is required and cannot exceed 80 characters." });
    }
    if (typeof sku !== "string" || !sku.trim() || sku.trim().length > 80) {
        return res.status(400).json({ success: false, message: "SKU is required and cannot exceed 80 characters." });
    }
    if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: "Stock must be a non-negative whole number." });
    }
    if (req.body?.images !== undefined) {
        return res.status(400).json({ success: false, message: "Upload image files using the multipart form-data field named 'images'." });
    }

    let assets;
    try {
        assets = await uploadProductImages(req.files);
    } catch (error) {
        console.error("Cloudinary image upload error:", error);
        const failure = cloudinaryUploadFailure(error);
        return res.status(failure.status).json({
            success: false,
            message: failure.message
        });
    }

    try {
        const product = await createProduct({
            name: name.trim(),
            description: description.trim(),
            price,
            category: category.trim(),
            sku: sku.trim().toUpperCase(),
            images: assets.map((asset) => asset.url),
            stock,
            createdBy: req.user.id
        });
        return res.status(201).json({ success: true, message: "Product created successfully.", product });
    } catch (error) {
        await deleteProductImages(assets);
        if (error.code === 11000) return res.status(409).json({ success: false, message: "A product with this SKU already exists." });
        if (error.name === "ValidationError") return res.status(400).json({ success: false, message: error.message });
        console.error("Create product error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export const updateAdminProduct = async (req, res) => {
    const { productId } = req.params;
    const body = req.body ?? {};

    if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const fields = Object.keys(body);
    const files = req.files ?? [];
    if (fields.length === 0 && files.length === 0) {
        return res.status(400).json({ success: false, message: "Provide at least one product field to update." });
    }
    const unsupportedFields = fields.filter((field) => !editableProductFields.has(field));
    if (unsupportedFields.length > 0) {
        return res.status(400).json({
            success: false,
            message: `These fields cannot be updated here: ${unsupportedFields.join(", ")}.`
        });
    }

    const updates = {};
    for (const field of fields) {
        const value = body[field];
        if (field === "name") {
            if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 120) {
                return res.status(400).json({ success: false, message: "Name must be 2 to 120 characters." });
            }
            updates.name = value.trim();
        } else if (field === "description") {
            if (typeof value !== "string" || !value.trim() || value.trim().length > 5000) {
                return res.status(400).json({ success: false, message: "Description is required and cannot exceed 5000 characters." });
            }
            updates.description = value.trim();
        } else if (field === "price") {
            const price = parseNumber(value);
            if (!Number.isFinite(price) || price < 0) {
                return res.status(400).json({ success: false, message: "Price must be a non-negative number." });
            }
            updates.price = price;
        } else if (field === "category") {
            if (typeof value !== "string" || !value.trim() || value.trim().length > 80) {
                return res.status(400).json({ success: false, message: "Category is required and cannot exceed 80 characters." });
            }
            updates.category = value.trim();
        } else if (field === "sku") {
            if (typeof value !== "string" || !value.trim() || value.trim().length > 80) {
                return res.status(400).json({ success: false, message: "SKU is required and cannot exceed 80 characters." });
            }
            updates.sku = value.trim().toUpperCase();
        } else if (field === "stock") {
            const stock = parseNumber(value);
            if (!Number.isInteger(stock) || stock < 0) {
                return res.status(400).json({ success: false, message: "Stock must be a non-negative whole number." });
            }
            updates.stock = stock;
        }
    }

    if (req.body?.images !== undefined) {
        return res.status(400).json({ success: false, message: "Upload image files using the multipart form-data field named 'images'." });
    }

    let assets;
    try {
        assets = await uploadProductImages(files);
    } catch (error) {
        console.error("Cloudinary image upload error:", error);
        const failure = cloudinaryUploadFailure(error);
        return res.status(failure.status).json({
            success: false,
            message: failure.message
        });
    }
    if (assets.length > 0) updates.images = assets.map((asset) => asset.url);

    try {
        const product = await updateProductById(productId, updates);
        if (!product) {
            await deleteProductImages(assets);
            return res.status(404).json({ success: false, message: "Product not found." });
        }
        emitProductChange(req.app.get("io"), product, updates);
        return res.status(200).json({ success: true, message: "Product updated successfully.", product });
    } catch (error) {
        await deleteProductImages(assets);
        if (error.code === 11000) return res.status(409).json({ success: false, message: "A product with this SKU already exists." });
        if (error.name === "ValidationError") return res.status(400).json({ success: false, message: error.message });
        console.error("Update product error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export const updateAdminProductStock = async (req, res) => {
    const { productId } = req.params;
    const stock = parseNumber(req.body?.stock);
    if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ success: false, message: "Invalid product ID." });
    if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: "Stock must be a non-negative whole number." });
    }
    try {
        const product = await updateProductById(productId, { stock });
        if (!product) return res.status(404).json({ success: false, message: "Product not found." });
        emitProductChange(req.app.get("io"), product, { stock: product.stock });
        return res.status(200).json({ success: true, message: "Product stock updated.", product });
    } catch (error) {
        if (error.name === "ValidationError") return res.status(400).json({ success: false, message: error.message });
        console.error("Update product stock error:", error);
        return res.status(500).json({ success: false, message: "Could not update product stock." });
    }
};

export const updateAdminProductStatus = async (req, res) => {
    const { productId } = req.params;
    const { status } = req.body ?? {};
    if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ success: false, message: "Invalid product ID." });
    if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({ success: false, message: "Status must be ACTIVE or INACTIVE." });
    }
    try {
        const isActive = status === "ACTIVE";
        const product = await updateProductById(productId, { isActive });
        if (!product) return res.status(404).json({ success: false, message: "Product not found." });
        emitProductChange(req.app.get("io"), product, { isActive });
        return res.status(200).json({ success: true, message: `Product ${status.toLowerCase()} successfully.`, product });
    } catch (error) {
        console.error("Update product status error:", error);
        return res.status(500).json({ success: false, message: "Could not update product status." });
    }
};

export const getPublicProducts = async (req, res) => {
    const page = Number.parseInt(req.query.page ?? "1", 10);
    const limit = Number.parseInt(req.query.limit ?? "20", 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ success: false, message: "Page must be positive; limit must be between 1 and 100." });
    }
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : "";
    try {
        const result = await listPublicProducts({ search, category, page, limit });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error("List products error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export const getPublicProduct = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID." });
    }
    try {
        const product = await findPublicProductById(req.params.productId);
        if (!product) return res.status(404).json({ success: false, message: "Product not found." });
        return res.status(200).json({ success: true, product });
    } catch (error) {
        console.error("Get product error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};
