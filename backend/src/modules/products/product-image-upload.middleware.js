import multer from "multer";

const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 8
    },
    fileFilter: (req, file, callback) => {
        if (!acceptedMimeTypes.has(file.mimetype)) {
            const error = new Error("Only JPEG, PNG, and WebP image files are allowed.");
            error.name = "UnsupportedImageTypeError";
            return callback(error);
        }
        callback(null, true);
    }
});

export const parseProductImageFiles = (req, res, next) => {
    upload.array("images", 8)(req, res, (error) => {
        if (!error) return next();
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ success: false, message: error.message });
    });
};
