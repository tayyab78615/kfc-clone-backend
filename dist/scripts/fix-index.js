"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../.env") });
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/test";
async function dropIndex() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose_1.default.connect(MONGO_URI);
        console.log("Connected.");
        const db = mongoose_1.default.connection.db;
        if (!db)
            throw new Error("DB connection failed");
        console.log("Checking indexes on 'users' collection...");
        const indexes = await db.collection("users").indexes();
        console.log("Current indexes:", JSON.stringify(indexes, null, 2));
        const hasUsernameIndex = indexes.some(idx => idx.name === "username_1");
        if (hasUsernameIndex) {
            console.log("Dropping 'username_1' index...");
            await db.collection("users").dropIndex("username_1");
            console.log("Index dropped successfully!");
        }
        else {
            console.log("'username_1' index not found.");
        }
    }
    catch (err) {
        console.error("Error:", err);
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log("Disconnected.");
        process.exit();
    }
}
dropIndex();
