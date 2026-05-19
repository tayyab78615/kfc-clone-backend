"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const menuItemSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    price: { type: String, required: true },
    desc: { type: String },
    imageUrl: { type: String, default: "" },
    category: {
        type: String,
        enum: [
            "explore",
            "bestseller",
            "topdeals",
            "promotions",
            "everydayvalue",
            "alacarte",
            "signatureboxes",
            "sharing",
        ],
        required: true,
    },
}, { timestamps: true });
const MenuItem = mongoose_1.default.model("MenuItem", menuItemSchema);
exports.default = MenuItem;
