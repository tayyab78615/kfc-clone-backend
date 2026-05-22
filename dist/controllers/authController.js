"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAddress = exports.getAddresses = exports.addAddress = exports.logout = exports.refresh = exports.login = exports.signup = void 0;
const User_1 = __importDefault(require("../models/User"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_TOKEN_COOKIE_NAME = "refreshToken";
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const getAccessSecret = () => {
    return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
};
const getRefreshSecret = () => {
    return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
};
//Generate access token
const generateAccessToken = (id) => {
    const secret = getAccessSecret();
    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not defined");
    }
    return jsonwebtoken_1.default.sign({ id }, secret, {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
};
//Generate refresh token
const generateRefreshToken = (id) => {
    const secret = getRefreshSecret();
    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not defined");
    }
    return jsonwebtoken_1.default.sign({ id }, secret, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
};
const getErrorMessage = (error) => {
    return error instanceof Error ? error.message : "Something went wrong";
};
// function converts a raw cookie string into a JS object.
const parseCookies = (cookieHeader) => {
    if (!cookieHeader) {
        return {};
    }
    return cookieHeader.split(";").reduce((acc, part) => {
        const [rawName, ...rawValue] = part.trim().split("=");
        if (!rawName || rawValue.length === 0) {
            return acc;
        }
        acc[rawName] = decodeURIComponent(rawValue.join("="));
        return acc;
    }, {});
};
// get refresh token from incoming request's cookie
const getRefreshTokenFromRequest = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[ACCESS_TOKEN_COOKIE_NAME];
};
//This stores refresh token in browser cookie.
const setRefreshTokenCookie = (res, refreshToken) => {
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};
const clearRefreshTokenCookie = (res) => {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
    });
};
const buildAuthResponse = (user) => {
    return {
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        addresses: user.addresses || [],
        accessToken: generateAccessToken(String(user._id)),
    };
};
//This stores refresh token in database.
const persistRefreshToken = async (userId, refreshToken) => {
    const hashedRefreshToken = await bcryptjs_1.default.hash(refreshToken, 10);
    await User_1.default.findByIdAndUpdate(userId, { refreshToken: hashedRefreshToken });
};
const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const exists = await User_1.default.findOne({ email });
        if (exists) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await User_1.default.create({
            name,
            email,
            password: hashedPassword,
            role: "user",
        });
        const refreshToken = generateRefreshToken(String(user._id));
        await persistRefreshToken(String(user._id), refreshToken);
        setRefreshTokenCookie(res, refreshToken);
        return res.json(buildAuthResponse(user));
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.signup = signup;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.default.findOne({ email });
        if (user && (await bcryptjs_1.default.compare(password, user.password))) {
            const refreshToken = generateRefreshToken(String(user._id));
            await persistRefreshToken(String(user._id), refreshToken);
            setRefreshTokenCookie(res, refreshToken);
            return res.json(buildAuthResponse(user));
        }
        return res.status(401).json({ message: "Invalid credentials" });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.login = login;
// create a new access token using refresh token.
const refresh = async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token missing" });
    }
    const secret = getRefreshSecret();
    if (!secret) {
        return res.status(500).json({ message: "JWT refresh secret is not configured" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, secret);
        const user = await User_1.default.findById(decoded.id).lean();
        if (!user || !user.refreshToken) {
            clearRefreshTokenCookie(res);
            return res.status(401).json({ message: "Invalid refresh token" });
        }
        const isValidToken = await bcryptjs_1.default.compare(refreshToken, user.refreshToken);
        if (!isValidToken) {
            clearRefreshTokenCookie(res);
            return res.status(401).json({ message: "Invalid refresh token" });
        }
        //generate new access token and save it in browser cookie
        const nextRefreshToken = generateRefreshToken(String(user._id));
        await persistRefreshToken(String(user._id), nextRefreshToken);
        setRefreshTokenCookie(res, nextRefreshToken);
        return res.json(buildAuthResponse(user));
    }
    catch (_error) {
        clearRefreshTokenCookie(res);
        return res.status(401).json({ message: "Invalid refresh token" });
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    const secret = getRefreshSecret();
    if (refreshToken && secret) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, secret);
            await User_1.default.findByIdAndUpdate(decoded.id, { $unset: { refreshToken: 1 } });
        }
        catch (_error) {
            // Ignore invalid refresh tokens during logout and still clear the cookie.
        }
    }
    clearRefreshTokenCookie(res);
    return res.json({ message: "Logged out successfully" });
};
exports.logout = logout;
const addAddress = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { id, type, locationName, latitude, longitude, house, street, landmark } = req.body;
        if (!id || !type || !locationName || !house || !street || !landmark) {
            return res.status(400).json({ message: "Missing required address fields" });
        }
        const newAddress = {
            id,
            type,
            locationName,
            latitude,
            longitude,
            house,
            street,
            landmark,
        };
        const user = await User_1.default.findByIdAndUpdate(req.userId, { $push: { addresses: { $each: [newAddress], $position: 0 } } }, { new: true, projection: { addresses: 1 } }).lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({
            message: "Address added successfully",
            addresses: user.addresses,
        });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.addAddress = addAddress;
const getAddresses = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const user = await User_1.default.findById(req.userId).select("addresses").lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({
            addresses: user.addresses || [],
        });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getAddresses = getAddresses;
const deleteAddress = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "Address ID is required" });
        }
        const user = await User_1.default.findByIdAndUpdate(req.userId, { $pull: { addresses: { id } } }, { new: true, projection: { addresses: 1 } }).lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({
            message: "Address deleted successfully",
            addresses: user.addresses,
        });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.deleteAddress = deleteAddress;
