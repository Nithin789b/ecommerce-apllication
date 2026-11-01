import "dotenv/config";
import mongoose from "mongoose";
import Product from "../src/modules/products/products.modal.js";
import User from "../src/modules/users/user.modal.js";

const DUMMYJSON_PRODUCTS_URL = "https://dummyjson.com/products?limit=0";

function mapProduct(item, createdBy) {
    return {
        name: item.title,
        title: item.title,
        description: item.description,
        price: item.price,
        category: item.category,
        images: item.images ?? (item.thumbnail ? [item.thumbnail] : []),
        thumbnail: item.thumbnail ?? item.images?.[0] ?? "",
        brand: item.brand ?? "",
        discountPercentage: item.discountPercentage ?? 0,
        rating: item.rating ?? 0,
        tags: item.tags ?? [],
        weight: item.weight,
        dimensions: item.dimensions,
        warrantyInformation: item.warrantyInformation ?? "",
        shippingInformation: item.shippingInformation ?? "",
        availabilityStatus: item.availabilityStatus ?? "",
        reviews: (item.reviews ?? []).map((review) => ({
            rating: review.rating,
            comment: review.comment,
            date: review.date ? new Date(review.date) : undefined,
            reviewerName: review.reviewerName
        })),
        returnPolicy: item.returnPolicy ?? "",
        minimumOrderQuantity: item.minimumOrderQuantity,
        sourceId: item.id,
        sourceMeta: {
            createdAt: item.meta?.createdAt ? new Date(item.meta.createdAt) : undefined,
            updatedAt: item.meta?.updatedAt ? new Date(item.meta.updatedAt) : undefined,
            barcode: item.meta?.barcode,
            qrCode: item.meta?.qrCode
        },
        stock: item.stock,
        sku: item.sku,
        isActive: true,
        version: 1,
        createdBy
    };
}

async function seedProducts() {
    const { MONGO_URI, SEED_USER_ID } = process.env;
    if (!MONGO_URI || !SEED_USER_ID) throw new Error("MONGO_URI and SEED_USER_ID are required.");
    if (!mongoose.isValidObjectId(SEED_USER_ID)) throw new Error("SEED_USER_ID must be a valid MongoDB ObjectId.");

    try {
        await mongoose.connect(MONGO_URI);
        const user = await User.findById(SEED_USER_ID).select("_id").lean();
        if (!user) throw new Error("SEED_USER_ID does not match an existing user.");

        const response = await fetch(DUMMYJSON_PRODUCTS_URL);
        if (!response.ok) throw new Error(`DummyJSON request failed with status ${response.status}.`);
        const data = await response.json();
        if (!Array.isArray(data.products) || data.products.length === 0) {
            throw new Error("DummyJSON returned no products.");
        }

        const products = data.products.map((item) => mapProduct(item, user._id));
        const operations = products.map((product) => ({
            updateOne: {
                filter: { sku: product.sku },
                update: { $setOnInsert: product },
                upsert: true
            }
        }));
        const result = await Product.bulkWrite(operations, { ordered: false });
        const inserted = result.upsertedCount ?? 0;

        console.log("DummyJSON product import completed.");
        console.log(`Fetched: ${products.length}`);
        console.log(`Inserted: ${inserted}`);
        console.log(`Already present: ${products.length - inserted}`);
    } finally {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    }
}

seedProducts().catch((error) => {
    console.error("Product import failed:", error.message);
    process.exitCode = 1;
});
