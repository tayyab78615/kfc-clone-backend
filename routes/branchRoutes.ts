import express from "express";
import {
  getBranches,
  getAllBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../controllers/branchController";
import { protect, superAdminOnly } from "../middleware/authMiddleware";

const router = express.Router();

// Public - active branches only
router.get("/", getBranches);

// SuperAdmin only
router.get("/all", protect, superAdminOnly, getAllBranches);
router.post("/", protect, superAdminOnly, createBranch);
router.put("/:id", protect, superAdminOnly, updateBranch);
router.delete("/:id", protect, superAdminOnly, deleteBranch);

export default router;