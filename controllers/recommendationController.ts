import type { Response } from "express";
import User from "../models/User";
import MenuItem from "../models/MenuItem";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";


// Defines request body structure.
interface RecommendationBody {
    currentCartIds: string[];
}

// Handles recommendation requests.
export const getRecommendations = async (
    req: AuthenticatedRequest<unknown, unknown, RecommendationBody>,
    res: Response,
) => {
    try {
        const { currentCartIds } = req.body;

        if (!Array.isArray(currentCartIds)) {
            return res.status(400).json({ message: "currentCartIds must be an array" });
        }

        // ── Step 1: Fetch all users' orders (only the orders field) 
        const users = await User.find({}, { orders: 1 });

        // ── Step 2: Build co-occurrence map
        // coMap[itemA][itemB] = number of times A and B appeared in the same order
        const coMap: Record<string, Record<string, number>> = {};

        for (const user of users) {
            for (const order of user.orders) {
                const ids = order.items.map((i) => i.productId);    //Convert items into array of IDs.

                // This compares EVERY item with EVERY other item.
                for (let i = 0; i < ids.length; i++) {
                    for (let j = 0; j < ids.length; j++) {
                        if (i === j) continue;   //skip if comparing same item.
                        const a = ids[i];
                        const b = ids[j];
                        if (!coMap[a]) coMap[a] = {};
                        coMap[a][b] = (coMap[a][b] ?? 0) + 1;
                    }
                }
            }
        }

        // ── Step 3: Score candidate items based on current cart
        // Add up co-occurrence scores for all items NOT already in the cart
        const scores: Record<string, number> = {};

        for (const cartId of currentCartIds) {
            const related = coMap[cartId] ?? {};
            for (const [itemId, count] of Object.entries(related)) {
                if (!currentCartIds.includes(itemId)) {
                    scores[itemId] = (scores[itemId] ?? 0) + count;
                }
            }
        }

        // ── Step 4: Sort by score, take top 4
        const topIds = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([id]) => id);

        let recommended = await MenuItem.find({ _id: { $in: topIds } });

        // ── Step 5: Fallback to bestsellers if no recommendations found ───────────
        if (recommended.length === 0) {
            recommended = await MenuItem.find({ category: "bestseller" }).limit(4);
        }

        return res.json({ recommendations: recommended });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Could not fetch recommendations";
        return res.status(500).json({ message });
    }
};