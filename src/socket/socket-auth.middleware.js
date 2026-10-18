import jwt from "jsonwebtoken";

const accessSecret = () => process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || process.env.JwT_SECRET;

export const authenticateSocket = (socket, next) => {
    const configuredSecret = accessSecret();
    if (!configuredSecret) return next(new Error("Socket authentication is unavailable."));

    const suppliedToken = socket.handshake.auth?.token;
    const token = typeof suppliedToken === "string" ? suppliedToken.replace(/^Bearer\s+/i, "") : "";
    if (!token) return next(new Error("An access token is required."));

    try {
        const user = jwt.verify(token, configuredSecret, {
            issuer: "ecommerce-api",
            audience: "ecommerce-client"
        });
        if (user.tokenType !== "access" || !user.id) return next(new Error("A valid access token is required."));

        let role = user.role;
        if (role === "admin") role = "ADMIN";
        if (role === "customer" || role === "salesperson") role = "USER";
        if (!["USER", "ADMIN"].includes(role)) return next(new Error("This account cannot use product updates."));

        socket.data.user = { id: user.id, role };
        return next();
    } catch {
        return next(new Error("Invalid or expired access token."));
    }
};
