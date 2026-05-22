import express, { type Response } from "express";
import MenuItem from "../models/MenuItem";
import User from "../models/User";
import { protect, type AuthenticatedRequest } from "../middleware/authMiddleware";

const router = express.Router();

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Something went wrong";
};

interface FavoriteRequestBody {
  productId?: string;
}

router.get("/", protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(req.userId).select("favorites").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ favorites: user.favorites || [] });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
});

router.post(
  "/",
  protect,
  async (
    req: AuthenticatedRequest<Record<string, never>, unknown, FavoriteRequestBody>,
    res: Response,
  ) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const [userExists, menuItem] = await Promise.all([
      User.exists({ _id: req.userId }),
      MenuItem.findById(productId).lean(),
    ]);

    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.userId, "favorites.productId": { $ne: productId } },
      {
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
      },
      { new: true, projection: { favorites: 1 } },
    ).lean();

    if (updatedUser) {
      return res.status(200).json({ favorites: updatedUser.favorites });
    }

    const user = await User.findById(req.userId).select("favorites").lean();
    return res.status(200).json({ favorites: user.favorites });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
  },
);

router.delete(
  "/:productId",
  protect,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Not authorized" });
      }

      const { productId } = req.params as { productId?: string };
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }
      const user = await User.findByIdAndUpdate(
        req.userId,
        { $pull: { favorites: { productId } } },
        { new: true, projection: { favorites: 1 } },
      ).lean();

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({ favorites: user.favorites });
    } catch (error) {
      return res.status(500).json({ message: getErrorMessage(error) });
    }
  },
);

export default router;
