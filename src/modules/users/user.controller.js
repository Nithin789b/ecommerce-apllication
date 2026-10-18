
import jwt from "jsonwebtoken";
import { createHash, timingSafeEqual } from "node:crypto";

import {
    findUserByEmail,
    createUser,
    verifyPassword,
    saveRefreshTokenHash,
    findUserByIdWithRefreshToken,
    clearRefreshTokenHash
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
const publicUser = (user) => ({ id: user._id, username: user.username, email: user.email, phone_number: user.phone_number, role: normalizeRole(user.role) });

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
                role: "USER"
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
