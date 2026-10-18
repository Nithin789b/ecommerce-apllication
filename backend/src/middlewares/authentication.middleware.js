import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const normalizedRole = (role) => {
    if (!role || role === "customer" || role === "salesperson") return "USER";
    if (role === "admin") return "ADMIN";
    return role;
};

const authenticateToken=(req,res,next)=>{
    const authHeader=req.headers.authorization;
    const [scheme, token] = authHeader ? authHeader.split(' ') : [];
    if(!token){
        return res.status(401).json({
            success:false,
            message:"Access denied. No token provided."
        });
    }
    if (scheme !== "Bearer") {
        return res.status(401).json({ success: false, message: "Use Authorization: Bearer <accessToken>." });
    }
    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || process.env.JwT_SECRET;
    if (!secret) return res.status(500).json({ success: false, message: "Access token secret is not configured." });
    jwt.verify(token,secret,{ issuer: "ecommerce-api", audience: "ecommerce-client" },(err,decoded)=>{
        if(err){
            return res.status(403).json({
                success:false,
                message: err.name === "TokenExpiredError" ? "Access token expired." : "Invalid token."
            });
        }
        if (decoded.tokenType !== "access" || !decoded.id) {
            return res.status(403).json({ success: false, message: "Invalid access token." });
        }
        req.user = { ...decoded, role: normalizedRole(decoded.role) };
        next();
    });
};

export default authenticateToken;

export const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "You do not have permission to access this resource." });
    }
    next();
};
