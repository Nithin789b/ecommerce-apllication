import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
    {
        addressLine1: { type: String, trim: true, maxlength: 200 },
        addressLine2: { type: String, trim: true, maxlength: 200 },
        city: { type: String, trim: true, maxlength: 100 },
        stateOrProvince: { type: String, trim: true, maxlength: 100 },
        postalCode: { type: String, trim: true, maxlength: 24 },
        countryCode: { type: String, trim: true, uppercase: true, minlength: 2, maxlength: 2 }
    },
    { _id: false }
);

const sellerDocumentSchema = new mongoose.Schema(
    {
        documentType: {
            type: String,
            enum: ["BUSINESS_REGISTRATION", "GST_CERTIFICATE", "PAN_DOCUMENT", "ADDRESS_PROOF", "BANK_PROOF", "OTHER"],
            required: true
        },
        
        storageKey: { type: String, required: true, select: false },
        originalName: { type: String, trim: true, maxlength: 255 },
        mimeType: { type: String, trim: true, maxlength: 100 },
        sizeBytes: { type: Number, min: 1 },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    },
    { _id: true }
);

const reviewHistorySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            enum: ["SUBMITTED", "REVIEW_STARTED", "CORRECTIONS_REQUESTED", "APPROVED", "REJECTED"],
            required: true
        },
        fromStatus: { type: String, enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED"] },
        toStatus: { type: String, enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED"], required: true },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        note: { type: String, trim: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: true }
);

const sellerSchema = new mongoose.Schema(
    {
        // One Seller application belongs to one existing User account.
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
            unique: true
        },

        businessName: { type: String, trim: true, maxlength: 200 },
        businessType: {
            type: String,
            enum: ["INDIVIDUAL", "SOLE_PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PRIVATE_LIMITED", "PUBLIC_LIMITED", "OTHER"]
        },
        businessEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
        businessPhone: { type: String, trim: true, maxlength: 32 },

        // These fields contain encrypted ciphertext, not plaintext identifiers.
        gstinEncrypted: { type: String, select: false },
        panEncrypted: { type: String, select: false },
        registrationNumberEncrypted: { type: String, select: false },
        registrationType: { type: String, trim: true, maxlength: 100 },

        registeredAddress: { type: addressSchema, default: () => ({}) },
        pickupAddress: { type: addressSchema, default: () => ({}) },
        documents: { type: [sellerDocumentSchema], default: [] },

        status: {
            type: String,
            enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED"],
            default: "DRAFT",
            required: true
        },
        submittedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
        reviewReason: { type: String, trim: true, maxlength: 2000, default: null },
        reviewHistory: { type: [reviewHistorySchema], default: [] },

        // Manual review is the only enabled verification method initially.
        // Provider outcomes must remain NOT_CHECKED until a real provider check occurs.
        verification: {
            method: {
                type: String,
                enum: ["MANUAL", "GST_PROVIDER", "REGISTRATION_PROVIDER", "BANK_PROVIDER"],
                default: "MANUAL"
            },
            outcome: {
                type: String,
                enum: ["NOT_CHECKED", "VERIFIED", "NOT_VERIFIED", "FAILED"],
                default: "NOT_CHECKED"
            },
            externalReference: { type: String, trim: true, maxlength: 200, default: null },
            checkedAt: { type: Date, default: null }
        }
    },
    { timestamps: true }
);

sellerSchema.index({ status: 1, submittedAt: -1 });

const Seller = mongoose.model("Seller", sellerSchema);

export default Seller;
