
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        // DummyJSON calls this field `title`; keep `name` as the storefront and
        // order field, while accepting title for direct catalog imports.
        name: {
            type: String,
            required: function () { return !this.title; },
            trim: true,
            minlength: [2, "Product name must have at least 2 characters"],
            maxlength: [120, "Product name cannot exceed 120 characters"]
        },

        title: { type: String, trim: true, maxlength: 120 },

        description: {
            type: String,
            required: [true, "Product description is required"],
            trim: true,
            maxlength: [5000, "Description cannot exceed 5000 characters"]
        },

        price: {
            type: Number,
            required: [true, "Product price is required"],
            min: [0, "Price cannot be negative"]
        },

        category: {
            type: String,
            required: [true, "Product category is required"],
            trim: true,
            maxlength: [80, "Category cannot exceed 80 characters"]
        },

        images: {
            type: [String],
            default: []
        },

        thumbnail: { type: String, trim: true, default: "" },
        brand: { type: String, trim: true, default: "" },
        discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
        rating: { type: Number, min: 0, max: 5, default: 0 },
        tags: { type: [String], default: [] },
        weight: { type: Number, min: 0 },
        dimensions: {
            width: { type: Number, min: 0 },
            height: { type: Number, min: 0 },
            depth: { type: Number, min: 0 }
        },
        warrantyInformation: { type: String, trim: true, default: "" },
        shippingInformation: { type: String, trim: true, default: "" },
        availabilityStatus: { type: String, trim: true, default: "" },
        reviews: [{
            rating: { type: Number, min: 0, max: 5 },
            comment: { type: String, trim: true },
            date: Date,
            reviewerName: { type: String, trim: true }
        }],
        returnPolicy: { type: String, trim: true, default: "" },
        minimumOrderQuantity: { type: Number, min: 1 },
        sourceId: { type: Number, index: true },
        sourceMeta: {
            createdAt: Date,
            updatedAt: Date,
            barcode: String,
            qrCode: String
        },

        stock: {
            type: Number,
            required: true,
            default: 0,
            min: [0, "Stock cannot be negative"],
            validate: {
                validator: Number.isInteger,
                message: "Stock must be a whole number"
            }
        },

        sku: {
            type: String,
            required: [true, "SKU is required"],
            unique: true,
            trim: true,
            uppercase: true
        },

        isActive: {
            type: Boolean,
            default: true
        },

        version: {
            type: Number,
            default: 1,
            min: 1
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true
        }
    },
    {
        timestamps: true
    }
);

productSchema.pre("validate", function () {
    if (!this.name && this.title) this.name = this.title;
    if (!this.title && this.name) this.title = this.name;
    if (!this.images?.length && this.thumbnail) this.images = [this.thumbnail];
    if (!this.thumbnail && this.images?.length) this.thumbnail = this.images[0];
});

const Product = mongoose.model("Product", productSchema);

export default Product;
