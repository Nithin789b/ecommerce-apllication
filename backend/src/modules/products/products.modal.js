
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
            minlength: [2, "Product name must have at least 2 characters"],
            maxlength: [120, "Product name cannot exceed 120 characters"]
        },

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

const Product = mongoose.model("Product", productSchema);

export default Product;
