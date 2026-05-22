"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const branchSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
branchSchema.index({ isActive: 1, createdAt: -1 });
branchSchema.index({ createdAt: -1 });
const Branch = mongoose_1.default.model("Branch", branchSchema);
exports.default = Branch;
