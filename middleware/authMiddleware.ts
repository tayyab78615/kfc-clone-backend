import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

interface TokenPayload {
  id: string;
}

export type AuthenticatedRequest<
  P = Record<string, never>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, unknown>,
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  userId?: string;
  userRole?: "user" | "admin" | "superadmin";
};

export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ message: "JWT access secret is not configured" });
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    const user = await User.findById(decoded.id).select("_id role");

    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.userId = String(user._id);
    req.userRole = user.role;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

export const adminOnly = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.userRole !== "admin" && req.userRole !== "superadmin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  return next();
};

export const superAdminOnly = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.userRole !== "superadmin") {
    return res.status(403).json({ message: "Super admin access required" });
  }

  return next();
};
