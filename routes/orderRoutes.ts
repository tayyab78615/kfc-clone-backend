import express from "express";
import { createOrder, getMyOrders, trackOrder } from "../controllers/orderController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/my", protect, getMyOrders);
router.get("/track/:orderId", trackOrder);

export default router;
