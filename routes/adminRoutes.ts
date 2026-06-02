import express from "express";
import { upload } from "../config/cloudinary";
import {
  createAdminMenuItem,
  createAdminUser,
  deleteAdminMenuItem,
  deleteOrderForSuperAdmin,
  getAdminMenuItems,
  getAdminUsers,
  getAllOrdersForSuperAdmin,
  getBestSellingItems,
  getOrderStatusValues,
  getSalesSummary,
  updateAdminMenuItem,
  updateOrderForSuperAdmin,
  updateAdminUser,
} from "../controllers/adminController";
import { adminOnly, protect, superAdminOnly } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/best-sellers", getBestSellingItems);
router.get("/status-values", getOrderStatusValues);

router.use(protect, adminOnly);

router.get("/users", getAdminUsers);
router.post("/users", superAdminOnly, createAdminUser);
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
