"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
//This route creates a new user (sign up)
router.post("/signup", authController_1.signup);
//This route authenticates existing users (log in)
router.post("/login", authController_1.login);
//This route issues a new access token when the current one expires
router.post("/refresh", authController_1.refresh);
//This route logs out the user by clearing the refresh token
router.post("/logout", authController_1.logout);
// Delivery address endpoints
router.post("/address", authMiddleware_1.protect, authController_1.addAddress);
router.get("/addresses", authMiddleware_1.protect, authController_1.getAddresses);
router.delete("/address/:id", authMiddleware_1.protect, authController_1.deleteAddress);
exports.default = router;
