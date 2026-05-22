"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const branchController_1 = require("../controllers/branchController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Public - active branches only
router.get("/", branchController_1.getBranches);
// SuperAdmin only
router.get("/all", authMiddleware_1.protect, authMiddleware_1.superAdminOnly, branchController_1.getAllBranches);
router.post("/", authMiddleware_1.protect, authMiddleware_1.superAdminOnly, branchController_1.createBranch);
router.put("/:id", authMiddleware_1.protect, authMiddleware_1.superAdminOnly, branchController_1.updateBranch);
router.delete("/:id", authMiddleware_1.protect, authMiddleware_1.superAdminOnly, branchController_1.deleteBranch);
exports.default = router;
