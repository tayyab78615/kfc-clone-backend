"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackOrder = exports.getMyOrders = exports.createOrder = void 0;
const Branch_1 = __importDefault(require("../models/Branch"));
const User_1 = __importDefault(require("../models/User"));
const toNumberPrice = (price) => Number.parseInt(price.replace(/[^0-9]/g, ""), 10) || 0;
const haversineKm = (lat1, lon1, lat2, lon2) => {
    const radiusKm = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const findNearestBranch = async (latitude, longitude) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }
    const branches = await Branch_1.default.find({ isActive: true }).lean();
    if (branches.length === 0) {
        return null;
    }
    return branches.reduce((best, branch) => {
        const distanceKm = haversineKm(latitude, longitude, branch.latitude, branch.longitude);
        if (!best || distanceKm < best.distanceKm) {
            return {
                branchId: String(branch._id),
                name: branch.name,
                address: branch.address,
                distanceKm: Number(distanceKm.toFixed(2)),
            };
        }
        return best;
    }, null);
};
const generateOrderId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "KFC-";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
const createOrder = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { items, totalItems, totalAmount, paymentMode, deliveryAddress } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Order items are required" });
        }
        if (!["online", "jazzcash"].includes(paymentMode)) {
            return res.status(400).json({ message: "Invalid payment mode" });
        }
        if (!deliveryAddress || !deliveryAddress.house || !deliveryAddress.street) {
            return res.status(400).json({ message: "Delivery address is required" });
        }
        const normalizedItems = items.map((item) => ({
            productId: item.id,
            name: item.name,
            unitPrice: item.price,
            quantity: item.qty,
            image: item.img,
        }));
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const orderId = generateOrderId();
        const latitude = Number(deliveryAddress.latitude);
        const longitude = Number(deliveryAddress.longitude);
        const branch = await findNearestBranch(latitude, longitude);
        user.orders.push({
            orderId,
            items: normalizedItems,
            totalItems,
            totalAmount,
            paymentMode,
            status: "paid",
            deliveryAddress: {
                house: deliveryAddress.house,
                street: deliveryAddress.street,
                landmark: deliveryAddress.landmark,
                ...(Number.isFinite(latitude) ? { latitude } : {}),
                ...(Number.isFinite(longitude) ? { longitude } : {}),
            },
            ...(branch ? { branch } : {}),
            customerInfo: {
                name: user.name,
                email: user.email,
            },
            createdAt: new Date(),
        });
        await user.save();
        return res.status(201).json({
            message: "Order saved successfully",
            order: user.orders[user.orders.length - 1],
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not create order";
        return res.status(500).json({ message });
    }
};
exports.createOrder = createOrder;
const getMyOrders = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const user = await User_1.default.findById(req.userId).select("orders").lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const orders = [...user.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return res.json({ orders });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not fetch orders";
        return res.status(500).json({ message });
    }
};
exports.getMyOrders = getMyOrders;
const trackOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!orderId || typeof orderId !== "string") {
            return res.status(400).json({ message: "Order ID is required" });
        }
        const upperId = orderId.toUpperCase();
        const user = await User_1.default.findOne({ "orders.orderId": upperId })
            .select({ "orders.$": 1 })
            .lean();
        if (!user) {
            return res.status(404).json({ message: "Order not found" });
        }
        const order = user.orders.find((o) => o.orderId === upperId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        return res.json({ order });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not track order";
        return res.status(500).json({ message });
    }
};
exports.trackOrder = trackOrder;
