"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    name: String,
    email: {
        type: String,
        unique: true,
    },
    password: String,
    role: {
        type: String,
        enum: ["user", "admin", "superadmin"],
        default: "user",
    },
    refreshToken: String,
    bucket: [
        {
            productId: String,
            name: String,
            price: Number,
            quantity: Number,
            image: String,
        },
    ],
    orders: [
        {
            items: [
                {
                    productId: String,
                    name: String,
                    unitPrice: String,
                    quantity: Number,
                    image: String,
                },
            ],
            totalItems: Number,
            totalAmount: Number,
            paymentMode: {
                type: String,
                enum: ["online", "jazzcash"],
            },
            status: {
                type: String,
                enum: ["pending", "paid"],
                default: "paid",
            },
            orderId: {
                type: String,
                unique: true,
                sparse: true,
            },
            deliveryAddress: {
                house: String,
                street: String,
                landmark: String,
            },
            customerInfo: {
                name: String,
                email: String,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    favorites: [
        {
            productId: String,
            name: String,
            price: String,
            image: String,
            desc: String,
            category: String,
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    addresses: [
        {
            id: String,
            type: {
                type: String,
                enum: ["home", "office"],
            },
            locationName: String,
            latitude: Number,
            longitude: Number,
            house: String,
            street: String,
            landmark: String,
        },
    ],
}, { timestamps: true });
userSchema.index({ "orders.createdAt": -1 });
userSchema.index({ "favorites.productId": 1 });
const User = mongoose_1.default.model("User", userSchema);
exports.default = User;
