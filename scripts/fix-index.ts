import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/test";

async function dropIndex() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected.");

        const db = mongoose.connection.db;
        if (!db) throw new Error("DB connection failed");

        console.log("Checking indexes on 'users' collection...");
        const indexes = await db.collection("users").indexes();
        console.log("Current indexes:", JSON.stringify(indexes, null, 2));

        const hasUsernameIndex = indexes.some(idx => idx.name === "username_1");

        if (hasUsernameIndex) {
            console.log("Dropping 'username_1' index...");
            await db.collection("users").dropIndex("username_1");
            console.log("Index dropped successfully!");
        } else {
            console.log("'username_1' index not found.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
        process.exit();
    }
}

dropIndex();
