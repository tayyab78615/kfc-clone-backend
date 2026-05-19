"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAdminMenuItem = exports.updateAdminMenuItem = exports.createAdminMenuItem = exports.getAdminMenuItems = exports.deleteOrderForSuperAdmin = exports.updateOrderForSuperAdmin = exports.getAllOrdersForSuperAdmin = exports.updateAdminUser = exports.getAdminUsers = void 0;
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const User_1 = __importDefault(require("../models/User"));
const validCategories = [
    "explore",
    "bestseller",
    "topdeals",
    "promotions",
    "everydayvalue",
    "alacarte",
    "signatureboxes",
    "sharing",
];
const getErrorMessage = (error) => {
    return error instanceof Error ? error.message : "Something went wrong";
};
const parsePriceAmount = (value) => {
    const normalized = value.replace(/[^0-9.-]/g, "");
    if (!normalized) {
        return Number.NaN;
    }
    return Number(normalized);
};
const normalizeMenuPayload = (body, imageUrl) => {
    const name = String(body.name || "").trim();
    const price = String(body.price || "").trim();
    const desc = String(body.desc || "").trim();
    const category = String(body.category || "").trim();
    if (!name || !price || !category) {
        return { error: "Name, price, and category are required" };
    }
    const priceAmount = parsePriceAmount(price);
    if (Number.isNaN(priceAmount)) {
        return { error: "Enter a valid price" };
    }
    if (priceAmount < 0) {
        return { error: "Price cannot be negative" };
    }
    if (!validCategories.includes(category)) {
        return { error: "Invalid menu category" };
    }
    return {
        data: {
            name,
            price,
            desc,
            category,
            ...(imageUrl ? { imageUrl } : {}),
        },
    };
};
const getAdminUsers = async (_req, res) => {
    try {
        const users = await User_1.default.find()
            .select("name email role createdAt updatedAt orders")
            .sort({ createdAt: -1 });
        return res.json({
            users: users.map((user) => ({
                _id: String(user._id),
                name: user.name,
                email: user.email,
                role: user.role,
                totalOrders: user.orders.length,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })),
        });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getAdminUsers = getAdminUsers;
const updateAdminUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role } = req.body;
        const user = await User_1.default.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (typeof name === "string" && name.trim()) {
            user.name = name.trim();
        }
        if (typeof email === "string" && email.trim()) {
            const normalizedEmail = email.trim().toLowerCase();
            const existingUser = await User_1.default.findOne({
                email: normalizedEmail,
                _id: { $ne: user._id },
            }).select("_id");
            if (existingUser) {
                return res.status(400).json({ message: "Email is already in use" });
            }
            user.email = normalizedEmail;
        }
        if (role === "superadmin" && req.userRole !== "superadmin") {
            return res.status(403).json({ message: "Only a super admin can assign super admin role" });
        }
        if (user.role === "superadmin" &&
            req.userRole !== "superadmin") {
            return res.status(403).json({ message: "Only a super admin can edit another super admin" });
        }
        if (role === "user" || role === "admin" || role === "superadmin") {
            user.role = role;
        }
        await user.save();
        return res.json({
            user: {
                _id: String(user._id),
                name: user.name,
                email: user.email,
                role: user.role,
                totalOrders: user.orders.length,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.updateAdminUser = updateAdminUser;
const calculateOrderTotals = (items) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    return { totalItems, totalAmount };
};
const findOrderById = (orders, orderId) => {
    return orders.find((order) => String(order._id) === orderId) ?? null;
};
const normalizeOrderItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return { error: "Order must include at least one item" };
    }
    const normalizedItems = items.map((item) => {
        const name = String(item.name || "").trim();
        const image = String(item.image || "").trim();
        const productId = String(item.productId || "").trim();
        const unitPrice = Number(item.unitPrice);
        const quantity = Number(item.quantity);
        if (!name || !image || !productId) {
            return null;
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            return null;
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            return null;
        }
        return {
            productId,
            name,
            unitPrice,
            quantity,
            image,
        };
    });
    if (normalizedItems.some((item) => item === null)) {
        return { error: "Each order item must include valid product, image, price, and quantity" };
    }
    return {
        data: normalizedItems,
    };
};
const getAllOrdersForSuperAdmin = async (_req, res) => {
    try {
        const users = await User_1.default.find()
            .select("name email orders")
            .sort({ createdAt: -1 });
        const orders = users.flatMap((user) => user.orders.map((order) => ({
            _id: String(order._id),
            userId: String(user._id),
            userName: user.name,
            userEmail: user.email,
            items: order.items.map((item) => ({
                _id: String(item._id),
                productId: item.productId,
                name: item.name,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                image: item.image,
            })),
            totalItems: order.totalItems,
            totalAmount: order.totalAmount,
            paymentMode: order.paymentMode,
            status: order.status,
            createdAt: order.createdAt,
        })));
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return res.json({ orders });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getAllOrdersForSuperAdmin = getAllOrdersForSuperAdmin;
const updateOrderForSuperAdmin = async (req, res) => {
    try {
        const rawUserId = req.params.userId;
        const rawOrderId = req.params.orderId;
        const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
        const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
        const { items, paymentMode, status } = req.body;
        if (!userId || !orderId) {
            return res.status(400).json({ message: "User ID and order ID are required" });
        }
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const order = findOrderById(user.orders, orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const normalized = normalizeOrderItems(items);
        if ("error" in normalized) {
            return res.status(400).json({ message: normalized.error });
        }
        if (paymentMode && !["online", "jazzcash"].includes(paymentMode)) {
            return res.status(400).json({ message: "Invalid payment mode" });
        }
        if (status && !["pending", "paid"].includes(status)) {
            return res.status(400).json({ message: "Invalid order status" });
        }
        order.items = normalized.data;
        order.paymentMode = paymentMode ?? order.paymentMode;
        order.status = status ?? order.status;
        const totals = calculateOrderTotals(normalized.data);
        order.totalItems = totals.totalItems;
        order.totalAmount = totals.totalAmount;
        await user.save();
        return res.json({
            order: {
                _id: String(order._id),
                userId: String(user._id),
                userName: user.name,
                userEmail: user.email,
                items: order.items.map((item) => ({
                    _id: String(item._id),
                    productId: item.productId,
                    name: item.name,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    image: item.image,
                })),
                totalItems: order.totalItems,
                totalAmount: order.totalAmount,
                paymentMode: order.paymentMode,
                status: order.status,
                createdAt: order.createdAt,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.updateOrderForSuperAdmin = updateOrderForSuperAdmin;
const deleteOrderForSuperAdmin = async (req, res) => {
    try {
        const rawUserId = req.params.userId;
        const rawOrderId = req.params.orderId;
        const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
        const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
        if (!userId || !orderId) {
            return res.status(400).json({ message: "User ID and order ID are required" });
        }
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const order = findOrderById(user.orders, orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        order.deleteOne();
        await user.save();
        return res.json({ message: "Order deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.deleteOrderForSuperAdmin = deleteOrderForSuperAdmin;
const getAdminMenuItems = async (_req, res) => {
    try {
        const items = await MenuItem_1.default.find().sort({ createdAt: -1, _id: -1 });
        return res.json({ items });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getAdminMenuItems = getAdminMenuItems;
const createAdminMenuItem = async (req, res) => {
    try {
        // Image is optional — if not uploaded, we use an empty string placeholder
        const imageUrl = req.file?.path ?? "";
        const normalized = normalizeMenuPayload(req.body, imageUrl);
        if ("error" in normalized) {
            return res.status(400).json({ message: normalized.error });
        }
        const item = await MenuItem_1.default.create(normalized.data);
        return res.status(201).json({ item });
    }
    catch (error) {
        console.error("[createAdminMenuItem] error:", error);
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.createAdminMenuItem = createAdminMenuItem;
const updateAdminMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await MenuItem_1.default.findById(id);
        if (!item) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        // Keep existing imageUrl if no new file was uploaded
        const nextImageUrl = req.file?.path ?? item.imageUrl;
        const normalized = normalizeMenuPayload(req.body, nextImageUrl);
        if ("error" in normalized) {
            return res.status(400).json({ message: normalized.error });
        }
        item.name = normalized.data.name;
        item.price = normalized.data.price;
        item.desc = normalized.data.desc ?? "";
        item.category = normalized.data.category;
        // Only update imageUrl if we actually have one
        if (normalized.data.imageUrl) {
            item.imageUrl = normalized.data.imageUrl;
        }
        await item.save();
        return res.json({ item });
    }
    catch (error) {
        console.error("[updateAdminMenuItem] error:", error);
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.updateAdminMenuItem = updateAdminMenuItem;
const deleteAdminMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await MenuItem_1.default.findByIdAndDelete(id);
        if (!item) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        return res.json({ message: "Menu item deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.deleteAdminMenuItem = deleteAdminMenuItem;
