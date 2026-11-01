import jwt from "jsonwebtoken";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { isPasswordResetEmailConfigured, sendPasswordResetEmail } from "./password-reset.mailer.js";

import {
    findUserByEmail,
    createUser,
    verifyPassword,
    saveRefreshTokenHash,
    findUserByIdWithRefreshToken,
    clearRefreshTokenHash,
    saveDefaultAddress,
    savePasswordReset,
    findUserByPasswordResetHash,
    updatePasswordWithResetToken
} from "./user.service.js";

const normalizeRole = (role) => {
    if (!role || role === "customer" || role === "salesperson") return "USER";
    if (role === "admin") return "ADMIN";
    return role;
};

const accessSecret = () => process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || process.env.JwT_SECRET;
const refreshSecret = () => process.env.REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET || accessSecret();
const accessExpiresIn = process.env.ACCESS_TOKEN_TTL || "15m";
const refreshExpiresIn = process.env.REFRESH_TOKEN_TTL || "7d";
const refreshCookie = "refreshToken";
const refreshCookieMaxAge = (() => {
    const match = /^(\d+)(s|m|h|d)$/.exec(refreshExpiresIn);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return Number(match[1]) * units[match[2]];
})();

const tokenOptions = { issuer: "ecommerce-api", audience: "ecommerce-client" };
const issueAccessToken = (user) => jwt.sign({ id: user._id.toString(), role: normalizeRole(user.role), tokenType: "access" }, accessSecret(), { ...tokenOptions, expiresIn: accessExpiresIn });
const issueRefreshToken = (user) => jwt.sign({ id: user._id.toString(), role: normalizeRole(user.role), tokenType: "refresh" }, refreshSecret(), { ...tokenOptions, expiresIn: refreshExpiresIn });
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const setRefreshCookie = (res, token) => res.cookie(refreshCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/users",
    maxAge: refreshCookieMaxAge
});
const clearRefreshCookie = (res) => res.clearCookie(refreshCookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/users" });
const publicUser = (user) => ({ id: user._id, username: user.username, email: user.email, phone_number: user.phone_number, role: normalizeRole(user.role), defaultAddress: user.defaultAddress ?? null });

const createSession = async (user, res) => {
    if (!accessSecret() || !refreshSecret()) throw new Error("Token secrets are not configured");
    const accessToken = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user);
    await saveRefreshTokenHash(user._id, hashToken(refreshToken));
    setRefreshCookie(res, refreshToken);
    return accessToken;
};

export const signupUser = async (req, res) => {
    const { username, email, phone_number, password } = req.body ?? {};

    try {
       
        if (typeof username !== "string" || !username.trim() ||
            typeof email !== "string" || !email.trim() ||
            typeof phone_number !== "string" || !phone_number.trim() ||
            typeof password !== "string" || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        
        const existingUser = await findUserByEmail(email);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists"
            });
        }

       
        const user = await createUser({
            username,
            email,
            phone_number,
            password
        });

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                phone_number: user.phone_number,
                role: "USER",
                defaultAddress: null
            }
        });
    } catch (error) {
        console.error("Signup error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const loginWithRole = async (req, res, requiredRole) => {
    const { email, password } = req.body ?? {};

    try {
        if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Fetch user through the service
        const user = await findUserByEmail(email);

        if (!user || normalizeRole(user.role) !== requiredRole) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Compare password against its hash
        const isPasswordValid = await verifyPassword(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const accessToken = await createSession(user, res);

        return res.status(200).json({
            success: true,
            message: `${requiredRole === "ADMIN" ? "Admin" : "User"} logged in successfully`,
            user: publicUser(user),
            accessToken,
            tokenType: "Bearer",
            expiresIn: accessExpiresIn
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const loginUser = (req, res) => loginWithRole(req, res, "USER");
export const loginAdmin = (req, res) => loginWithRole(req, res, "ADMIN");

const passwordResetLinkFor = (token) => {
    const clientUrl = process.env.CLIENT_URL;
    if (!clientUrl) throw new Error("CLIENT_URL is not configured");
    const normalizedClientUrl = clientUrl.endsWith("/") ? clientUrl.slice(0, -1) : clientUrl;
    return `${normalizedClientUrl}/reset-password?token=${encodeURIComponent(token)}`;
};

const canReturnResetLinkForDevelopment = () =>
    process.env.NODE_ENV !== "production" && process.env.RESET_PASSWORD_RETURN_LINK === "true";

export const requestPasswordReset = async (req, res) => {
    const email = req.body?.email;
    if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ success: false, message: "A valid email address is required." });
    }

    if (!isPasswordResetEmailConfigured() && !canReturnResetLinkForDevelopment()) {
        return res.status(503).json({ success: false, message: "Password reset email is not configured." });
    }

    try {
        const timings = {};
        let stepStartedAt = performance.now();
        const user = await findUserByEmail(email);
        timings.userLookupMs = Math.round((performance.now() - stepStartedAt) * 100) / 100;
        const response = {
            success: true,
            message: "If an account exists for that email, password reset instructions have been sent."
        };

        if (!user) return res.status(200).json(response);

        const resetToken = randomBytes(32).toString("hex");
        const tokenHash = hashToken(resetToken);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        stepStartedAt = performance.now();
        await savePasswordReset(user._id, tokenHash, expiresAt);
        timings.tokenSaveMs = Math.round((performance.now() - stepStartedAt) * 100) / 100;
        const resetUrl = passwordResetLinkFor(resetToken);

        if (isPasswordResetEmailConfigured()) {
            stepStartedAt = performance.now();
            await sendPasswordResetEmail(user.email, resetUrl);
            timings.emailSendMs = Math.round((performance.now() - stepStartedAt) * 100) / 100;
        } else {
            response.resetUrl = resetUrl;
            response.message = "Development reset link generated. This response is enabled only outside production.";
        }

        timings.totalMs = Math.round((Object.values(timings).reduce((total, duration) => total + duration, 0)) * 100) / 100;
        console.info("Password reset request timings:", timings);
        return res.status(200).json(response);
    } catch (error) {
        console.error("Password reset request error:", error);
        return res.status(503).json({ success: false, message: "Could not send password reset instructions. Please try again later." });
    }
};

export const resetPassword = async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== "string" || !token.trim() || typeof password !== "string" || password.length < 8 || password.length > 128) {
        return res.status(400).json({ success: false, message: "Provide the reset token and a password between 8 and 128 characters." });
    }

    try {
        const tokenHash = hashToken(token);
        const user = await findUserByPasswordResetHash(tokenHash);
        if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
            return res.status(400).json({ success: false, message: "This password reset link is invalid or expired. Request a new one." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const updatedUser = await updatePasswordWithResetToken(tokenHash, hashedPassword);
        if (!updatedUser) {
            return res.status(400).json({ success: false, message: "This password reset link is invalid or expired. Request a new one." });
        }

        clearRefreshCookie(res);
        return res.status(200).json({ success: true, message: "Password updated. Please sign in with your new password." });
    } catch (error) {
        console.error("Password reset error:", error);
        return res.status(500).json({ success: false, message: "Could not reset the password." });
    }
};

export const refreshSession = async (req, res) => {
    const token = req.cookies?.[refreshCookie];
    if (!token) return res.status(401).json({ success: false, message: "Refresh token is required." });
    try {
        const decoded = jwt.verify(token, refreshSecret(), tokenOptions);
        if (decoded.tokenType !== "refresh" || !decoded.id) throw new Error("Invalid refresh token");
        const user = await findUserByIdWithRefreshToken(decoded.id);
        if (!user?.refreshTokenHash) throw new Error("Refresh session is revoked");
        const actual = Buffer.from(hashToken(token), "hex");
        const expected = Buffer.from(user.refreshTokenHash, "hex");
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Refresh token reuse detected");
        const accessToken = await createSession(user, res);
        return res.status(200).json({ success: true, accessToken, tokenType: "Bearer", expiresIn: accessExpiresIn, role: normalizeRole(user.role) });
    } catch (error) {
        clearRefreshCookie(res);
        return res.status(401).json({ success: false, message: "Refresh token is invalid or expired. Please log in again." });
    }
};

export const logoutUser = async (req, res) => {
    const token = req.cookies?.[refreshCookie];
    if (token) {
        try {
            const decoded = jwt.verify(token, refreshSecret(), tokenOptions);
            if (decoded.tokenType === "refresh" && decoded.id) await clearRefreshTokenHash(decoded.id);
        } catch { /* Always clear the client cookie, even if the token has expired. */ }
    }
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: "Logged out successfully." });
};

export const getCurrentUser = async (req, res) => {
    try {
        const user = await findUserByIdWithRefreshToken(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });
        return res.status(200).json({ success: true, user: publicUser(user) });
    } catch (error) {
        console.error("Get current user error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const addressFieldLimits = {
    recipientName: 120,
    phone: 30,
    addressLine1: 200,
    city: 100,
    state: 100,
    postalCode: 20,
    country: 100
};

export const updateDefaultAddress = async (req, res) => {
    const address = req.body ?? {};
    const requiredFieldsAreValid = Object.entries(addressFieldLimits).every(([field, maxLength]) =>
        typeof address[field] === "string" &&
        address[field].trim().length > 0 &&
        address[field].trim().length <= maxLength
    );
    const optionalLineIsValid = address.addressLine2 === undefined ||
        (typeof address.addressLine2 === "string" && address.addressLine2.length <= 200);

    if (!requiredFieldsAreValid || !optionalLineIsValid) {
        return res.status(400).json({
            success: false,
            message: "Provide recipientName, phone, addressLine1, city, state, postalCode, and country with valid lengths."
        });
    }

    try {
        const defaultAddress = Object.fromEntries(
            [...Object.keys(addressFieldLimits), "addressLine2"]
                .filter((field) => address[field] !== undefined)
                .map((field) => [field, address[field].trim()])
        );
        if (defaultAddress.addressLine2 === undefined) defaultAddress.addressLine2 = "";

        const user = await saveDefaultAddress(req.user.id, defaultAddress);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        return res.status(200).json({
            success: true,
            message: "Default address saved.",
            user: publicUser(user)
        });
    } catch (error) {
        console.error("Save default address error:", error);
        return res.status(500).json({ success: false, message: "Could not save the default address." });
    }
};
