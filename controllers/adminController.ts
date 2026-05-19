import type { Request, Response } from "express";
import MenuItem from "../models/MenuItem";
import User from "../models/User";
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
    const users = await User.find()
      .select("name email role createdAt updatedAt orders")
      .sort({ createdAt: -1 });

    return res.json({
      users: users.map((user) => ({
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        totalOrders: user.orders.length,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
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
      role?: "user" | "admin" | "superadmin";
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

    if (role === "user" || role === "admin" || role === "superadmin") {
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
  status?: "pending" | "paid";
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
  status: "pending" | "paid";
  deliveryAddress: {
    house: string;
    street: string;
    landmark: string;
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

    const users = await User.find()
      .select("name email orders")
      .sort({ createdAt: -1 });

    const allOrders = users.flatMap((user) =>
      user.orders.map((order) => ({
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
        customerInfo: order.customerInfo,
        createdAt: order.createdAt,
      })),
    );

    allOrders.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = allOrders.length;
    const skip = (page - 1) * limit;
    const orders = allOrders.slice(skip, skip + limit);

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

    if (status && !["pending", "paid"].includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    order.items = normalized.data;
    order.paymentMode = paymentMode ?? order.paymentMode;
    order.status = status ?? order.status;

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
      MenuItem.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
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
    const users = await User.find().select("orders");

    const salesMap = new Map<string, { name: string; totalSold: number; lastSoldAt: string | null }>();


    //Each user likely has multiple orders.
    for (const user of users) {
      for (const order of user.orders) {

        //Each order contains an array of items.
        for (const item of order.items) {

          //Check if Product Already Exists in Map
          const existing = salesMap.get(item.productId);

          //If product exists, update the total sold and last sold at
          if (existing) {
            existing.totalSold += item.quantity;

            //Update Last Sold Date (if newer)
            if (!existing.lastSoldAt || new Date(order.createdAt) > new Date(existing.lastSoldAt)) {
              existing.lastSoldAt = order.createdAt.toISOString();
            }
          } else {
            //If product does not exist, add it to the map
            salesMap.set(item.productId, {
              name: item.name,
              totalSold: item.quantity,
              lastSoldAt: order.createdAt.toISOString(),
            });
          }
        }
      }
    }

    const summary = Array.from(salesMap.values()).sort((a, b) => b.totalSold - a.totalSold);

    return res.json({ summary, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getBestSellingItems = async (_req: Request, res: Response) => {
  try {
    const users = await User.find().select("orders");

    // Map: productId → { name, image, unitPrice, totalSold }
    const salesMap = new Map<
      string,
      { productId: string; name: string; image: string; unitPrice: string; totalSold: number }
    >();

    for (const user of users) {
      for (const order of user.orders) {
        for (const item of order.items) {
          const existing = salesMap.get(item.productId);
          if (existing) {
            existing.totalSold += item.quantity;
          } else {
            salesMap.set(item.productId, {
              productId: item.productId,
              name: item.name,
              image: item.image,
              unitPrice: item.unitPrice,
              totalSold: item.quantity,
            });
          }
        }
      }
    }

    // Sort by most sold, descending
    const bestSellers = Array.from(salesMap.values()).sort(
      (a, b) => b.totalSold - a.totalSold,
    );

    return res.json({ bestSellers, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};
