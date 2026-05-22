import express, { type Request, type Response } from "express";
import MenuItem from "../models/MenuItem";

const router = express.Router();

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Something went wrong";
};

router.get("/", async (_req: Request, res: Response) => {
  try {
    const items = await MenuItem.find().sort({ createdAt: -1, _id: -1 }).lean();
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
});

export default router;
