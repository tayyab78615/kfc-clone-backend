"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const recommendationController_1 = require("../controllers/recommendationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// POST /api/recommendations
// Body: { currentCartIds: string[] }
// Returns: { recommendations: MenuItem[] }
router.post("/", authMiddleware_1.protect, recommendationController_1.getRecommendations);
exports.default = router;
