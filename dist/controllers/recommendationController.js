"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendations = void 0;
const User_1 = __importDefault(require("../models/User"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
// Handles recommendation requests.
const getRecommendations = async (req, res) => {
    try {
        const { currentCartIds } = req.body;
        if (!Array.isArray(currentCartIds)) {
            return res.status(400).json({ message: "currentCartIds must be an array" });
        }
        // ── Step 1: Fetch all users' orders (only the orders field) 
        const currentCartSet = new Set(currentCartIds);
        const relevantOrders = await User_1.default.aggregate([
            { $unwind: "$orders" },
            { $match: { "orders.items.productId": { $in: currentCartIds } } },
            { $project: { _id: 0, itemIds: "$orders.items.productId" } },
        ]);
        // ── Step 2: Build co-occurrence map
        // coMap[itemA][itemB] = number of times A and B appeared in the same order
        const coMap = {};
        for (const order of relevantOrders) {
            const ids = order.itemIds; //Convert items into array of IDs.
            // This compares EVERY item with EVERY other item.
            for (let i = 0; i < ids.length; i++) {
                for (let j = 0; j < ids.length; j++) {
                    if (i === j)
                        continue; //skip if comparing same item.
                    const a = ids[i];
                    const b = ids[j];
                    if (!a || !b)
                        continue;
                    if (!coMap[a])
                        coMap[a] = {};
                    coMap[a][b] = (coMap[a][b] ?? 0) + 1;
                }
            }
        }
        // ── Step 3: Score candidate items based on current cart
        // Add up co-occurrence scores for all items NOT already in the cart
        const scores = {};
        for (const cartId of currentCartIds) {
            const related = coMap[cartId] ?? {};
            for (const [itemId, count] of Object.entries(related)) {
                if (!currentCartSet.has(itemId)) {
                    scores[itemId] = (scores[itemId] ?? 0) + count;
                }
            }
        }
        // ── Step 4: Sort by score, take top 4
        const topIds = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([id]) => id);
        let recommended = await MenuItem_1.default.find({ _id: { $in: topIds } }).lean();
        // ── Step 5: Fallback to bestsellers if no recommendations found ───────────
        if (recommended.length === 0) {
            recommended = await MenuItem_1.default.find({ category: "bestseller" }).limit(4).lean();
        }
        return res.json({ recommendations: recommended });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Could not fetch recommendations";
        return res.status(500).json({ message });
    }
};
exports.getRecommendations = getRecommendations;
