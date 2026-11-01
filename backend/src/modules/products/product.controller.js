import mongoose from "mongoose";
import {
    bulkUpsertProducts,
    createProduct,
    findPublicProductById,
    listPublicProducts,
    updateProductById
} from "./product.service.js";
import Product from "./products.modal.js";
import { uploadProductImages, deleteProductImages } from "./product-image.service.js";
import { emitProductChange } from "./product-socket-events.js";

const editableProductFields = new Set(["name", "description", "price", "category", "sku", "images", "stock", "title", "brand", "discountPercentage", "rating", "tags", "thumbnail", "weight", "dimensions", "warrantyInformation", "shippingInformation", "availabilityStatus", "reviews", "returnPolicy", "minimumOrderQuantity"]);

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
    const body = req.body ?? {};
    const name = body.name ?? body.title;
    const { description, category } = body;
    const sku = body.sku ?? `IMPORT-${body.id ?? Date.now()}`;
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
    if (req.body?.images !== undefined && !Array.isArray(req.body.images)) {
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
            images: assets.length ? assets.map((asset) => asset.url) : (Array.isArray(body.images) ? body.images : body.thumbnail ? [body.thumbnail] : []),
            ...catalogMetadata(body),
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

const catalogMetadata = (body = {}) => {
    const { id, meta, ...fields } = body;
    const allowed = ["title", "brand", "discountPercentage", "rating", "tags", "thumbnail", "weight", "dimensions", "warrantyInformation", "shippingInformation", "availabilityStatus", "reviews", "returnPolicy", "minimumOrderQuantity"];
    const metadata = Object.fromEntries(allowed.filter((field) => fields[field] !== undefined).map((field) => [field, fields[field]]));
    if (id !== undefined) metadata.sourceId = Number(id);
    if (meta && typeof meta === "object") metadata.sourceMeta = meta;
    return metadata;
};

export const bulkImportAdminProducts = async (req, res) => {
    const rows = Array.isArray(req.body) ? req.body : req.body?.products;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
        return res.status(400).json({ success: false, message: "Provide a products array containing between 1 and 200 products." });
    }

    const documents = [];
    const errors = [];
    for (const [index, row] of rows.entries()) {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
            errors.push({ index, message: "Product must be a JSON object." });
            continue;
        }
        const name = row.name ?? row.title;
        const sku = row.sku ?? (row.id !== undefined ? `IMPORT-${row.id}` : "");
        const images = Array.isArray(row.images) ? row.images : row.thumbnail ? [row.thumbnail] : [];
        const document = new Product({
            name,
            title: row.title ?? name,
            description: row.description,
            price: row.price,
            category: row.category,
            sku,
            stock: row.stock ?? 0,
            images,
            ...catalogMetadata(row),
            createdBy: req.user.id
        });
        try {
            await document.validate();
            documents.push(document);
        } catch (error) {
            errors.push({ index, message: error.message });
        }
    }
    if (errors.length) return res.status(400).json({ success: false, message: "Some products are invalid; nothing was imported.", errors });

    try {
        const operations = documents.map((document) => {
            const product = document.toObject();
            return { updateOne: { filter: { sku: product.sku }, update: { $setOnInsert: product }, upsert: true } };
        });
        const result = await bulkUpsertProducts(operations);
        const imported = result.upsertedCount ?? 0;
        return res.status(200).json({
            success: true,
            message: `Imported ${imported} product(s); ${documents.length - imported} existing SKU(s) skipped.`,
            imported,
            skipped: documents.length - imported
        });
    } catch (error) {
        console.error("Bulk product import error:", error);
        return res.status(500).json({ success: false, message: "Bulk import failed. Check SKU values and try again." });
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
        } else if (["discountPercentage", "rating", "weight", "minimumOrderQuantity"].includes(field)) {
            const number = parseNumber(value);
            const minimum = field === "minimumOrderQuantity" ? 1 : 0;
            const maximum = ["discountPercentage", "rating"].includes(field) ? (field === "rating" ? 5 : 100) : Number.POSITIVE_INFINITY;
            if (!Number.isFinite(number) || number < minimum || number > maximum) {
                return res.status(400).json({ success: false, message: `${field} must be between ${minimum} and ${maximum}.` });
            }
            updates[field] = number;
        } else if (["title", "brand", "thumbnail", "warrantyInformation", "shippingInformation", "availabilityStatus", "returnPolicy"].includes(field)) {
            if (typeof value !== "string") return res.status(400).json({ success: false, message: `${field} must be text.` });
            updates[field] = value.trim();
        } else if (["tags", "dimensions", "reviews"].includes(field)) {
            updates[field] = value;
        } else if (field === "stock") {
            const stock = parseNumber(value);
            if (!Number.isInteger(stock) || stock < 0) {
                return res.status(400).json({ success: false, message: "Stock must be a non-negative whole number." });
            }
            updates.stock = stock;
        }
    }

    // Keep the aliases used by the import format and the storefront in sync.
    if (Object.hasOwn(body, "title") && !Object.hasOwn(body, "name")) updates.name = updates.title;
    else if (Object.hasOwn(body, "name")) updates.title = updates.name;

    if (req.body?.images !== undefined && !Array.isArray(req.body.images)) {
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
    if (assets.length > 0) {
        updates.images = assets.map((asset) => asset.url);
        updates.thumbnail = updates.images[0] ?? "";
    } else if (Array.isArray(body.images)) {
        updates.images = body.images;
        updates.thumbnail = body.images[0] ?? "";
    } else if (typeof body.thumbnail === "string") {
        updates.images = [body.thumbnail];
    }

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
