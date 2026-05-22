import type { Request, Response } from "express";
import Branch from "../models/Branch";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

// Public: get all active branches
export const getBranches = async (_req: Request, res: Response) => {
  try {
    const branches = await Branch.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    res.json({ branches });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

// SuperAdmin: get all branches (including inactive)
export const getAllBranches = async (_req: Request, res: Response) => {
  try {
    const branches = await Branch.find().sort({ createdAt: -1 }).lean();
    res.json({ branches });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

// SuperAdmin: create branch
export const createBranch = async (req: Request, res: Response) => {
  try {
    const { name, latitude, longitude, address } = req.body as {
      name: string;
      latitude: number;
      longitude: number;
      address?: string;
    };

    if (!name || latitude === undefined || longitude === undefined) {
      res.status(400).json({ message: "Name, latitude, and longitude are required" });
      return;
    }

    const branch = await Branch.create({ name, latitude, longitude, address: address ?? "" });
    res.status(201).json({ branch });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

// SuperAdmin: update branch
export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findByIdAndUpdate(id, req.body, { new: true });
    if (!branch) {
      res.status(404).json({ message: "Branch not found" });
      return;
    }
    res.json({ branch });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

// SuperAdmin: delete branch
export const deleteBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Branch.findByIdAndDelete(id);
    res.json({ message: "Branch deleted" });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};
