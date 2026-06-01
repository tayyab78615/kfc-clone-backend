import express from "express";
import {
  getRiderOrders,
  updateRiderOrderStatus,
} from "../controllers/riderController";
import { protect, riderOnly } from "../middleware/authMiddleware";

const router = express.Router();

router.use(protect, riderOnly);

router.get("/orders", getRiderOrders);
router.patch("/orders/:userId/:orderId/status", updateRiderOrderStatus);

export default router;
