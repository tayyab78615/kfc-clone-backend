"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminOnly = exports.adminOnly = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Not authorized, token missing" });
    }
    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ message: "JWT access secret is not configured" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const user = await User_1.default.findById(decoded.id).select("_id role").lean();
        if (!user) {
            return res.status(401).json({ message: "Not authorized, user not found" });
        }
        req.userId = String(user._id);
        req.userRole = user.role;
        return next();
    }
    catch (_error) {
        return res.status(401).json({ message: "Not authorized, invalid token" });
    }
};
exports.protect = protect;
const adminOnly = (req, res, next) => {
    if (req.userRole !== "admin" && req.userRole !== "superadmin") {
        return res.status(403).json({ message: "Admin access required" });
    }
    return next();
};
exports.adminOnly = adminOnly;
const superAdminOnly = (req, res, next) => {
    if (req.userRole !== "superadmin") {
        return res.status(403).json({ message: "Super admin access required" });
    }
    return next();
};
exports.superAdminOnly = superAdminOnly;
