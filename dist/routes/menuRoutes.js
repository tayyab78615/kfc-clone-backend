"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const router = express_1.default.Router();
const getErrorMessage = (error) => {
    return error instanceof Error ? error.message : "Something went wrong";
};
router.get("/", async (_req, res) => {
    try {
        const items = await MenuItem_1.default.find();
        return res.json(items);
    }
    catch (err) {
        return res.status(500).json({ error: getErrorMessage(err) });
    }
});
exports.default = router;
