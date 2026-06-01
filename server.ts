import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db";
import authRoutes from "./routes/authRoutes";
import menuRoutes from "./routes/menuRoutes";
import orderRoutes from "./routes/orderRoutes";
import adminRoutes from "./routes/adminRoutes";
import favoriteRoutes from "./routes/favoriteRoutes";
import recommendationRoutes from "./routes/recommendationRoutes"; // ← NEW
import branchRoutes from "./routes/branchRoutes";
import riderRoutes from "./routes/riderRoutes";

connectDB();

const app = express();
const port = process.env.PORT || "5000";
const clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/recommendations", recommendationRoutes); // ← NEW
app.use("/api/branches", branchRoutes);
app.use("/api/rider", riderRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log("Order statuses enabled: pending, paid, on_delivery, delivered, completed, cancelled");
});
