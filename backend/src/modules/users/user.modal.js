import mongoose from "mongoose";

const defaultAddressSchema = new mongoose.Schema({
    recipientName: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    addressLine1: { type: String, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200, default: "" },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 100 }
}, { _id: false });

const userSchema = new mongoose.Schema({
    username: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone_number: { type: String, required: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["USER", "ADMIN"],
        default: "USER",
        required: true
    },
    defaultAddress: { type: defaultAddressSchema, default: null },
    otp: { type: String, default: null },
    refreshTokenHash: { type: String, default: null, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false }
}, {
    timestamps: true
});

const userModel = mongoose.model("User", userSchema);
export default userModel;
