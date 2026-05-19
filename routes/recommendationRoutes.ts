import express from "express";
import { getRecommendations } from "../controllers/recommendationController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

// POST /api/recommendations
// Body: { currentCartIds: string[] }
// Returns: { recommendations: MenuItem[] }
router.post("/", protect, getRecommendations);

export default router;