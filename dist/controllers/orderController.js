"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyOrders = exports.createOrder = void 0;
const User_1 = __importDefault(require("../models/User"));
const toNumberPrice = (price) => Number.parseInt(price.replace(/[^0-9]/g, ""), 10) || 0;
const createOrder = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { items, totalItems, totalAmount, paymentMode } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Order items are required" });
        }
        if (!["online", "jazzcash"].includes(paymentMode)) {
            return res.status(400).json({ message: "Invalid payment mode" });
        }
        const normalizedItems = items.map((item) => ({
            productId: item.id,
            name: item.name,
            unitPrice: toNumberPrice(item.price),
            quantity: item.qty,
            image: item.img,
        }));
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        user.orders.push({
            items: normalizedItems,
            totalItems,
            totalAmount,
            paymentMode,
            status: "paid",
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
        const user = await User_1.default.findById(req.userId).select("orders");
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
