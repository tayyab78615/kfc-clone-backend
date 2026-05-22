"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("./config/db"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const menuRoutes_1 = __importDefault(require("./routes/menuRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const favoriteRoutes_1 = __importDefault(require("./routes/favoriteRoutes"));
const recommendationRoutes_1 = __importDefault(require("./routes/recommendationRoutes")); // ← NEW
const branchRoutes_1 = __importDefault(require("./routes/branchRoutes"));
(0, db_1.default)();
const app = (0, express_1.default)();
const port = process.env.PORT || "5000";
const clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";
app.use((0, cors_1.default)({
    origin: clientOrigin,
    credentials: true,
}));
app.use(express_1.default.json());
app.use("/api/auth", authRoutes_1.default);
app.use("/api/menu", menuRoutes_1.default);
app.use("/api/orders", orderRoutes_1.default);
app.use("/api/admin", adminRoutes_1.default);
app.use("/api/favorites", favoriteRoutes_1.default);
app.use("/api/recommendations", recommendationRoutes_1.default); // ← NEW
app.use("/api/branches", branchRoutes_1.default);
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
