"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRiderOrderStatus = exports.getRiderOrders = void 0;
const User_1 = __importDefault(require("../models/User"));
const getErrorMessage = (error) => error instanceof Error ? error.message : "Something went wrong";
const riderVisibleStatuses = ["paid", "on_delivery"];
const buildBranchKey = (order) => order.branch?.branchId || order.branch?.name || "unassigned";
const buildBranchName = (order) => order.branch?.name || "Branch not recorded";
const buildBranchAddress = (order) => order.branch?.address || "";
const getRiderOrders = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const users = await User_1.default.find({
            orders: { $elemMatch: { status: { $in: riderVisibleStatuses } } },
        })
            .select("name email orders")
            .lean();
        const grouped = new Map();
        users.forEach((user) => {
            user.orders.forEach((order) => {
                const isAvailable = order.status === "paid" && !order.rider?.riderId;
                const isMine = order.status === "on_delivery" &&
                    order.rider?.riderId === req.userId;
                if (!isAvailable && !isMine) {
                    return;
                }
                const branchId = buildBranchKey(order);
                if (!grouped.has(branchId)) {
                    grouped.set(branchId, {
                        branchId,
                        branchName: buildBranchName(order),
                        branchAddress: buildBranchAddress(order),
                        orders: [],
                    });
                }
                grouped.get(branchId)?.orders.push({
                    _id: String(order._id),
                    userId: String(user._id),
                    userName: user.name,
                    userEmail: user.email,
                    orderId: order.orderId,
                    items: order.items,
                    totalItems: order.totalItems,
                    totalAmount: order.totalAmount,
                    paymentMode: order.paymentMode,
                    status: order.status,
                    deliveryAddress: order.deliveryAddress,
                    branch: order.branch,
                    rider: order.rider,
                    customerInfo: order.customerInfo,
                    createdAt: order.createdAt,
                });
            });
        });
        return res.json({ branches: Array.from(grouped.values()) });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getRiderOrders = getRiderOrders;
const updateRiderOrderStatus = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { userId, orderId } = req.params;
        const nextStatus = req.body.status;
        if (nextStatus !== "on_delivery" && nextStatus !== "delivered") {
            return res.status(400).json({ message: "Riders can only set on delivery or delivered status" });
        }
        const rider = await User_1.default.findById(req.userId).select("name email role").lean();
        if (!rider || rider.role !== "rider") {
            return res.status(403).json({ message: "Rider access required" });
        }
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const order = user.orders.find((entry) => String(entry._id) === orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (nextStatus === "on_delivery") {
            if (order.rider?.riderId && order.rider.riderId !== req.userId) {
                return res.status(409).json({ message: "This order is already selected by another rider" });
            }
            if (order.status !== "paid" && order.status !== "on_delivery") {
                return res.status(400).json({ message: "Only paid orders can be selected for delivery" });
            }
            order.status = "on_delivery";
            order.rider = {
                riderId: req.userId,
                name: rider.name,
                email: rider.email,
            };
        }
        if (nextStatus === "delivered") {
            if (order.rider?.riderId !== req.userId) {
                return res.status(403).json({ message: "You can only deliver orders selected by you" });
            }
            order.status = "delivered";
        }
        await user.save();
        return res.json({
            order: {
                _id: String(order._id),
                userId: String(user._id),
                userName: user.name,
                userEmail: user.email,
                orderId: order.orderId,
                items: order.items,
                totalItems: order.totalItems,
                totalAmount: order.totalAmount,
                paymentMode: order.paymentMode,
                status: order.status,
                deliveryAddress: order.deliveryAddress,
                branch: order.branch,
                rider: order.rider,
                customerInfo: order.customerInfo,
                createdAt: order.createdAt,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.updateRiderOrderStatus = updateRiderOrderStatus;
