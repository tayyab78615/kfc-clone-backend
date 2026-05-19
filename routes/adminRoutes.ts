import express from "express";
import { upload } from "../config/cloudinary";
import {
  createAdminMenuItem,
  deleteAdminMenuItem,
  deleteOrderForSuperAdmin,
  getAdminMenuItems,
  getAdminUsers,
  getAllOrdersForSuperAdmin,
  getBestSellingItems,
  getSalesSummary,
  updateAdminMenuItem,
  updateOrderForSuperAdmin,
  updateAdminUser,
} from "../controllers/adminController";
import { adminOnly, protect, superAdminOnly } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/best-sellers", getBestSellingItems);

router.use(protect, adminOnly);

router.get("/users", getAdminUsers);
router.put("/users/:id", updateAdminUser);

router.get("/menu", getAdminMenuItems);
router.post("/menu", upload.single("image"), createAdminMenuItem);
router.put("/menu/:id", upload.single("image"), updateAdminMenuItem);
router.delete("/menu/:id", deleteAdminMenuItem);

router.get("/orders", superAdminOnly, getAllOrdersForSuperAdmin);
router.put("/orders/:userId/:orderId", superAdminOnly, updateOrderForSuperAdmin);
router.delete("/orders/:userId/:orderId", superAdminOnly, deleteOrderForSuperAdmin);

router.get("/sales-summary", superAdminOnly, getSalesSummary);

export default router;
