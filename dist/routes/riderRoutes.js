"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const riderController_1 = require("../controllers/riderController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.use(authMiddleware_1.protect, authMiddleware_1.riderOnly);
router.get("/orders", riderController_1.getRiderOrders);
router.patch("/orders/:userId/:orderId/status", riderController_1.updateRiderOrderStatus);
exports.default = router;
