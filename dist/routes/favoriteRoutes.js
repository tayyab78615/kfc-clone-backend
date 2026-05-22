"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const User_1 = __importDefault(require("../models/User"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const getErrorMessage = (error) => {
    return error instanceof Error ? error.message : "Something went wrong";
};
router.get("/", authMiddleware_1.protect, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const user = await User_1.default.findById(req.userId).select("favorites").lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json({ favorites: user.favorites || [] });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
});
router.post("/", authMiddleware_1.protect, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        const [userExists, menuItem] = await Promise.all([
            User_1.default.exists({ _id: req.userId }),
            MenuItem_1.default.findById(productId).lean(),
        ]);
        if (!userExists) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!menuItem) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        const updatedUser = await User_1.default.findOneAndUpdate({ _id: req.userId, "favorites.productId": { $ne: productId } }, {
            $push: {
                favorites: {
                    $each: [{
                            productId,
                            name: menuItem.name,
                            price: menuItem.price,
                            image: menuItem.imageUrl,
                            desc: menuItem.desc,
                            category: menuItem.category,
                            createdAt: new Date(),
                        }],
                    $position: 0,
                },
            },
        }, { new: true, projection: { favorites: 1 } }).lean();
        if (updatedUser) {
            return res.status(200).json({ favorites: updatedUser.favorites });
        }
        const user = await User_1.default.findById(req.userId).select("favorites").lean();
        return res.status(200).json({ favorites: user.favorites });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
});
router.delete("/:productId", authMiddleware_1.protect, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { productId } = req.params;
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        const user = await User_1.default.findByIdAndUpdate(req.userId, { $pull: { favorites: { productId } } }, { new: true, projection: { favorites: 1 } }).lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ favorites: user.favorites });
    }
    catch (error) {
        return res.status(500).json({ message: getErrorMessage(error) });
    }
});
exports.default = router;
