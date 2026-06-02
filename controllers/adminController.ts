import type { Request, Response } from "express";
import MenuItem from "../models/MenuItem";
import User, { type OrderStatus } from "../models/User";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

const validCategories = [
  "explore",
  "bestseller",
  "topdeals",
  "promotions",
  "everydayvalue",
  "alacarte",
  "signatureboxes",
  "sharing",
] as const;

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Something went wrong";
};

const normalizeOrderStatus = (status: unknown): OrderStatus | null => {
  if (typeof status !== "string") return null;
  const s = status.trim().toLowerCase();

  const aliases: Record<string, OrderStatus> = {
    pending: "pending",
    paid: "paid",
    complete: "completed",
    completed: "completed",
    competed: "completed",
    canceled: "cancelled",
    cancelled: "cancelled",
    on_delivery: "on_delivery",
    "on delivery": "on_delivery",
    delivered: "delivered",
  };

  return aliases[s] ?? null;
};

export const getOrderStatusValues = (_req: Request, res: Response) => {
  return res.json({
    source: "adminController",
    allowedStatuses: ["pending", "paid", "on_delivery", "delivered", "completed", "cancelled"],
    // acceptedAliases: ["complete", "completed", "competed", "canceled", "cancelled"],
  });
};

const parsePriceAmount = (value: string) => {
  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized) {
    return Number.NaN;
  }

  return Number(normalized);
};

const normalizeMenuPayload = (
  body: Record<string, unknown>,
  imageUrl?: string,
) => {
  const name = String(body.name || "").trim();
  const price = String(body.price || "").trim();
  const desc = String(body.desc || "").trim();
  const category = String(body.category || "").trim();

  if (!name || !price || !category) {
    return { error: "Name, price, and category are required" };
  }

  const priceAmount = parsePriceAmount(price);
  if (Number.isNaN(priceAmount)) {
    return { error: "Enter a valid price" };
  }

  if (priceAmount < 0) {
    return { error: "Price cannot be negative" };
  }

  if (!validCategories.includes(category as (typeof validCategories)[number])) {
    return { error: "Invalid menu category" };
  }

  return {
    data: {
      name,
      price,
      desc,
      category,
      ...(imageUrl ? { imageUrl } : {}),
    },
  };
};

export const getAdminUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          createdAt: 1,
          updatedAt: 1,
          totalOrders: { $size: { $ifNull: ["$orders", []] } },
        },
      },
    ]);

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const createAdminUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "user" | "admin" | "superadmin" | "rider";
    };

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).select("_id");
    if (existing) {
      return res.status(400).json({ message: "A user with that email already exists" });
    }

    const validRoles = ["user", "admin", "superadmin", "rider"] as const;
    const assignedRole = validRoles.includes(role as typeof validRoles[number]) ? role! : "user";

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(String(password), 10);

    const newUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
    });

    return res.status(201).json({
      user: {
        _id: String(newUser._id),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        totalOrders: 0,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};


export const updateAdminUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body as {
      name?: string;
      email?: string;
      role?: "user" | "admin" | "superadmin" | "rider";
    };

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof name === "string" && name.trim()) {
      user.name = name.trim();
    }

    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      }).select("_id");

      if (existingUser) {
        return res.status(400).json({ message: "Email is already in use" });
      }

      user.email = normalizedEmail;
    }

    if (role === "superadmin" && (req as AuthenticatedRequest).userRole !== "superadmin") {
      return res.status(403).json({ message: "Only a super admin can assign super admin role" });
    }

    if (
      user.role === "superadmin" &&
      (req as AuthenticatedRequest).userRole !== "superadmin"
    ) {
      return res.status(403).json({ message: "Only a super admin can edit another super admin" });
    }

    if (role === "user" || role === "admin" || role === "superadmin" || role === "rider") {
      user.role = role;
    }

    await user.save();

    return res.json({
      user: {
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        totalOrders: user.orders.length,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

interface OrderUpdateBody {
  items: {
    productId?: string;
    name?: string;
    unitPrice?: string;
    quantity?: number;
    image?: string;
  }[];
  paymentMode?: "online" | "jazzcash";
  status?: OrderStatus;
}

interface EditableOrder {
  _id?: { toString(): string };
  orderId: string;
  items: {
    _id?: { toString(): string };
    productId: string;
    name: string;
    unitPrice: string;
    quantity: number;
    image: string;
  }[];
  totalItems: number;
  totalAmount: number;
  paymentMode: "online" | "jazzcash";
  status: OrderStatus;
  deliveryAddress: {
    house: string;
    street: string;
    landmark: string;
    latitude?: number;
    longitude?: number;
  };
  branch?: {
    branchId: string;
    name: string;
    address: string;
    distanceKm?: number;
  };
  rider?: {
    riderId: string;
    name: string;
    email: string;
  };
  customerInfo: {
    name: string;
    email: string;
  };
  createdAt: Date;
  deleteOne(): void;
}

const calculateOrderTotals = (
  items: {
    unitPrice: string;
    quantity: number;
  }[],
) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => {
      const priceStr = String(item.unitPrice).replace(/[^0-9.]/g, "");
      const price = Number(priceStr) || 0;
      return sum + price * item.quantity;
    },
    0,
  );

  return { totalItems, totalAmount };
};

const findOrderById = (
  orders: EditableOrder[],
  orderId: string,
) => {
  return orders.find((order) => String(order._id) === orderId) ?? null;
};

const normalizeOrderItems = (items: OrderUpdateBody["items"]) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Order must include at least one item" };
  }

  const normalizedItems = items.map((item) => {
    const name = String(item.name || "").trim();
    const image = String(item.image || "").trim();
    const productId = String(item.productId || "").trim();
    const unitPrice = String(item.unitPrice || "");
    const quantity = Number(item.quantity);

    if (!name || !image || !productId) {
      return null;
    }

    if (!unitPrice) {
      return null;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return null;
    }

    return {
      productId,
      name,
      unitPrice,
      quantity,
      image,
    };
  });

  if (normalizedItems.some((item) => item === null)) {
    return { error: "Each order item must include valid product, image, price, and quantity" };
  }

  return {
    data: normalizedItems as {
      productId: string;
      name: string;
      unitPrice: string;
      quantity: number;
      image: string;
    }[],
  };
};

export const getAllOrdersForSuperAdmin = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const [result] = await User.aggregate([
      { $unwind: "$orders" },
      { $sort: { "orders.createdAt": -1, "orders._id": -1 } },
      {
        $facet: {
          orders: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: { $toString: "$orders._id" },
                userId: { $toString: "$_id" },
                userName: "$name",
                userEmail: "$email",
                orderId: "$orders.orderId",
                items: "$orders.items",
                totalItems: "$orders.totalItems",
                totalAmount: "$orders.totalAmount",
                paymentMode: "$orders.paymentMode",
                status: "$orders.status",
                deliveryAddress: "$orders.deliveryAddress",
                branch: "$orders.branch",
                rider: "$orders.rider",
                customerInfo: "$orders.customerInfo",
                createdAt: "$orders.createdAt",
              },
            },
          ],
          metadata: [{ $count: "total" }],
        },
      },
    ]);

    const orders = result?.orders ?? [];
    const total = result?.metadata?.[0]?.total ?? 0;

    return res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const updateOrderForSuperAdmin = async (req: Request, res: Response) => {
  try {
    const rawUserId = req.params.userId;
    const rawOrderId = req.params.orderId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
    const { items, paymentMode, status } = req.body as OrderUpdateBody;

    if (!userId || !orderId) {
      return res.status(400).json({ message: "User ID and order ID are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const order = findOrderById(user.orders as unknown as EditableOrder[], orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const normalized = normalizeOrderItems(items);
    if ("error" in normalized) {
      return res.status(400).json({ message: normalized.error });
    }

    if (paymentMode && !["online", "jazzcash"].includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid payment mode" });
    }

    const normalizedStatus = status === undefined ? undefined : normalizeOrderStatus(status);
    if (status !== undefined && !normalizedStatus) {
      return res.status(400).json({
        message: "Invalid order status",
        receivedStatus: status,
        allowedStatuses: ["pending", "paid", "on_delivery", "delivered", "completed", "cancelled"],
      });
    }

    order.items = normalized.data;
    order.paymentMode = paymentMode ?? order.paymentMode;
    order.status = normalizedStatus ?? order.status;

    const totals = calculateOrderTotals(normalized.data);
    order.totalItems = totals.totalItems;
    order.totalAmount = totals.totalAmount;

    await user.save();

    return res.json({
      order: {
        _id: String(order._id),
        userId: String(user._id),
        userName: user.name,
        userEmail: user.email,
        orderId: order.orderId,
        items: order.items.map((item) => ({
          _id: String(item._id),
          productId: item.productId,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          image: item.image,
        })),
        totalItems: order.totalItems,
        totalAmount: order.totalAmount,
        paymentMode: order.paymentMode,
        status: order.status,
        deliveryAddress: order.deliveryAddress,
        branch: order.branch,
        rider: order.rider,
        customerInfo: order.customerInfo,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const deleteOrderForSuperAdmin = async (req: Request, res: Response) => {
  try {
    const rawUserId = req.params.userId;
    const rawOrderId = req.params.orderId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;

    if (!userId || !orderId) {
      return res.status(400).json({ message: "User ID and order ID are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const order = findOrderById(user.orders as unknown as EditableOrder[], orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.deleteOne();
    await user.save();

    return res.json({ message: "Order deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getAdminMenuItems = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      MenuItem.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      MenuItem.countDocuments(),
    ]);

    return res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const createAdminMenuItem = async (req: Request, res: Response) => {
  try {
    // Image is optional — if not uploaded, we use an empty string placeholder
    const imageUrl = req.file?.path ?? "";

    const normalized = normalizeMenuPayload(req.body as Record<string, unknown>, imageUrl);
    if ("error" in normalized) {
      return res.status(400).json({ message: normalized.error });
    }

    const item = await MenuItem.create(normalized.data);
    return res.status(201).json({ item });
  } catch (error) {
    console.error("[createAdminMenuItem] error:", error);
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const updateAdminMenuItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Keep existing imageUrl if no new file was uploaded
    const nextImageUrl = req.file?.path ?? item.imageUrl;
    const normalized = normalizeMenuPayload(
      req.body as Record<string, unknown>,
      nextImageUrl,
    );

    if ("error" in normalized) {
      return res.status(400).json({ message: normalized.error });
    }

    item.name = normalized.data.name;
    item.price = normalized.data.price;
    item.desc = normalized.data.desc ?? "";
    item.category = normalized.data.category as typeof item.category;
    // Only update imageUrl if we actually have one
    if (normalized.data.imageUrl) {
      item.imageUrl = normalized.data.imageUrl;
    }

    await item.save();

    return res.json({ item });
  } catch (error) {
    console.error("[updateAdminMenuItem] error:", error);
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const deleteAdminMenuItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    return res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getSalesSummary = async (_req: Request, res: Response) => {
  try {
    const summary = await User.aggregate([
      { $unwind: "$orders" },
      { $unwind: "$orders.items" },
      {
        $group: {
          _id: "$orders.items.productId",
          name: { $first: "$orders.items.name" },
          totalSold: { $sum: "$orders.items.quantity" },
          lastSoldAt: { $max: "$orders.createdAt" },
        },
      },
      { $sort: { totalSold: -1 } },
      {
        $project: {
          _id: 0,
          name: 1,
          totalSold: 1,
          lastSoldAt: {
            $dateToString: {
              date: "$lastSoldAt",
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
              timezone: "UTC",
            },
          },
        },
      },
    ]);

    return res.json({ summary, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getBestSellingItems = async (_req: Request, res: Response) => {
  try {
    const aggregatedBestSellers = await User.aggregate([
      { $unwind: "$orders" },
      { $unwind: "$orders.items" },
      {
        $group: {
          _id: "$orders.items.productId",
          productId: { $first: "$orders.items.productId" },
          name: { $first: "$orders.items.name" },
          image: { $first: "$orders.items.image" },
          unitPrice: { $first: "$orders.items.unitPrice" },
          totalSold: { $sum: "$orders.items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      {
        $project: {
          _id: 0,
          productId: 1,
          name: 1,
          image: 1,
          unitPrice: 1,
          totalSold: 1,
        },
      },
    ]);

    return res.json({ bestSellers: aggregatedBestSellers, fetchedAt: new Date().toISOString() });

  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};
