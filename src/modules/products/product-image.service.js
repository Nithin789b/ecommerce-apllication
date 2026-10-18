import { Readable } from "node:stream";
import { getCloudinary } from "../../config/cloudinary.js";

const getUploadTimeout = () => {
    const configuredTimeout = Number(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS);
    return Number.isInteger(configuredTimeout) && configuredTimeout >= 1000
        ? configuredTimeout
        : 120000;
};

const uploadOneImage = (cloudinary, file) => new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
        {
            folder: "ecommerce/products",
            resource_type: "image",
            timeout: getUploadTimeout()
        },
        (error, result) => {
            if (error) return reject(error);
            resolve({ url: result.secure_url, publicId: result.public_id });
        }
    );
    Readable.from([file.buffer]).pipe(uploadStream);
});

export const uploadProductImages = async (files = []) => {
    if (files.length === 0) return [];
    const cloudinary = getCloudinary();
    const uploaded = [];
    try {
        for (const file of files) uploaded.push(await uploadOneImage(cloudinary, file));
        return uploaded;
    } catch (error) {
        await deleteProductImages(uploaded);
        throw error;
    }
};

export const deleteProductImages = async (assets = []) => {
    if (assets.length === 0) return;
    let cloudinary;
    try {
        cloudinary = getCloudinary();
    } catch {
        return;
    }
    await Promise.all(assets.map(async ({ publicId }) => {
        try {
            await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        } catch (error) {
            console.error("Cloudinary cleanup failed:", error.message);
        }
    }));
};
