"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBestSellingItems = exports.getSalesSummary = exports.deleteAdminMenuItem = exports.updateAdminMenuItem = exports.createAdminMenuItem = exports.getAdminMenuItems = exports.deleteOrderForSuperAdmin = exports.updateOrderForSuperAdmin = exports.getAllOrdersForSuperAdmin = exports.updateAdminUser = exports.getAdminUsers = exports.getOrderStatusValues = void 0;
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
const normalizeOrderStatus = (status) => {
    if (typeof status !== "string")
        return null;
    const s = status.trim().toLowerCase();
    const aliases = {
        pending: "pending",
        paid: "paid",
        complete: "completed",
        completed: "completed",
        competed: "completed",
        canceled: "cancelled",
        cancelled: "cancelled",
    };
    return aliases[s] ?? null;
};
const getOrderStatusValues = (_req, res) => {
    return res.json({
        source: "adminController",
        allowedStatuses: ["pending", "paid", "completed", "cancelled"],
        acceptedAliases: ["complete", "completed", "competed", "canceled", "cancelled"],
    });
};
exports.getOrderStatusValues = getOrderStatusValues;
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
        const users = await User_1.default.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    name: 1,
                    email: 1,
                    role: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    totalOrders: { $size: { $ifNull: ["$orders", []] } },
                },
            },
        ]);
        return res.json({ users });
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
    const totalAmount = items.reduce((sum, item) => {
        const priceStr = String(item.unitPrice).replace(/[^0-9.]/g, "");
        const price = Number(priceStr) || 0;
        return sum + price * item.quantity;
    }, 0);
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
        const unitPrice = String(item.unitPrice || "");
        const quantity = Number(item.quantity);
        if (!name || !image || !productId) {
            return null;
        }
        if (!unitPrice) {
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
const getAllOrdersForSuperAdmin = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const [result] = await User_1.default.aggregate([
            { $unwind: "$orders" },
            { $sort: { "orders.createdAt": -1, "orders._id": -1 } },
            {
                $facet: {
                    orders: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: { $toString: "$orders._id" },
                                userId: { $toString: "$_id" },
                                userName: "$name",
                                userEmail: "$email",
                                orderId: "$orders.orderId",
                                items: "$orders.items",
                                totalItems: "$orders.totalItems",
                                totalAmount: "$orders.totalAmount",
                                paymentMode: "$orders.paymentMode",
                                status: "$orders.status",
                                deliveryAddress: "$orders.deliveryAddress",
                                customerInfo: "$orders.customerInfo",
                                createdAt: "$orders.createdAt",
                            },
                        },
                    ],
                    metadata: [{ $count: "total" }],
                },
            },
        ]);
        const orders = result?.orders ?? [];
        const total = result?.metadata?.[0]?.total ?? 0;
        return res.json({
            orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
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
        const normalizedStatus = status === undefined ? undefined : normalizeOrderStatus(status);
        if (status !== undefined && !normalizedStatus) {
            return res.status(400).json({
                message: "Invalid order status",
                receivedStatus: status,
                allowedStatuses: ["pending", "paid", "completed", "cancelled"],
            });
        }
        order.items = normalized.data;
        order.paymentMode = paymentMode ?? order.paymentMode;
        order.status = normalizedStatus ?? order.status;
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
                orderId: order.orderId,
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
                deliveryAddress: order.deliveryAddress,
                customerInfo: order.customerInfo,
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
const getAdminMenuItems = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            MenuItem_1.default.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
            MenuItem_1.default.countDocuments(),
        ]);
        return res.json({
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
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
const getSalesSummary = async (_req, res) => {
    try {
        const summary = await User_1.default.aggregate([
            { $unwind: "$orders" },
            { $unwind: "$orders.items" },
            {
                $group: {
                    _id: "$orders.items.productId",
                    name: { $first: "$orders.items.name" },
                    totalSold: { $sum: "$orders.items.quantity" },
                    lastSoldAt: { $max: "$orders.createdAt" },
                },
            },
            { $sort: { totalSold: -1 } },
            {
                $project: {
                    _id: 0,
                    name: 1,
                    totalSold: 1,
                    lastSoldAt: {
                        $dateToString: {
                            date: "$lastSoldAt",
                            format: "%Y-%m-%dT%H:%M:%S.%LZ",
                            timezone: "UTC",
                        },
                    },
                },
            },
        ]);
        return res.json({ summary, fetchedAt: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getSalesSummary = getSalesSummary;
const getBestSellingItems = async (_req, res) => {
    try {
        const aggregatedBestSellers = await User_1.default.aggregate([
            { $unwind: "$orders" },
            { $unwind: "$orders.items" },
            {
                $group: {
                    _id: "$orders.items.productId",
                    productId: { $first: "$orders.items.productId" },
                    name: { $first: "$orders.items.name" },
                    image: { $first: "$orders.items.image" },
                    unitPrice: { $first: "$orders.items.unitPrice" },
                    totalSold: { $sum: "$orders.items.quantity" },
                },
            },
            { $sort: { totalSold: -1 } },
            {
                $project: {
                    _id: 0,
                    productId: 1,
                    name: 1,
                    image: 1,
                    unitPrice: 1,
                    totalSold: 1,
                },
            },
        ]);
        return res.json({ bestSellers: aggregatedBestSellers, fetchedAt: new Date().toISOString() });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getBestSellingItems = getBestSellingItems;
