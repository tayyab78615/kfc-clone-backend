"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBranch = exports.updateBranch = exports.createBranch = exports.getAllBranches = exports.getBranches = void 0;
const Branch_1 = __importDefault(require("../models/Branch"));
const getErrorMessage = (error) => error instanceof Error ? error.message : "Something went wrong";
// Public: get all active branches
const getBranches = async (_req, res) => {
    try {
        const branches = await Branch_1.default.find({ isActive: true }).sort({ createdAt: -1 }).lean();
        res.json({ branches });
    }
    catch (error) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getBranches = getBranches;
// SuperAdmin: get all branches (including inactive)
const getAllBranches = async (_req, res) => {
    try {
        const branches = await Branch_1.default.find().sort({ createdAt: -1 }).lean();
        res.json({ branches });
    }
    catch (error) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.getAllBranches = getAllBranches;
// SuperAdmin: create branch
const createBranch = async (req, res) => {
    try {
        const { name, latitude, longitude, address } = req.body;
        if (!name || latitude === undefined || longitude === undefined) {
            res.status(400).json({ message: "Name, latitude, and longitude are required" });
            return;
        }
        const branch = await Branch_1.default.create({ name, latitude, longitude, address: address ?? "" });
        res.status(201).json({ branch });
    }
    catch (error) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.createBranch = createBranch;
// SuperAdmin: update branch
const updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const branch = await Branch_1.default.findByIdAndUpdate(id, req.body, { new: true });
        if (!branch) {
            res.status(404).json({ message: "Branch not found" });
            return;
        }
        res.json({ branch });
    }
    catch (error) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.updateBranch = updateBranch;
// SuperAdmin: delete branch
const deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;
        await Branch_1.default.findByIdAndDelete(id);
        res.json({ message: "Branch deleted" });
    }
    catch (error) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
};
exports.deleteBranch = deleteBranch;
