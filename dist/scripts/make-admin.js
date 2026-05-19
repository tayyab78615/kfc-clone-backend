"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("../config/db"));
const User_1 = __importDefault(require("../models/User"));
dotenv_1.default.config();
const email = process.argv[2]?.trim().toLowerCase();
const roleArg = process.argv[3]?.trim().toLowerCase();
const role = roleArg === "superadmin" ? "superadmin" : "admin";
const run = async () => {
    if (!email) {
        throw new Error("Usage: npm run make-admin -- user@example.com [superadmin]");
    }
    await (0, db_1.default)();
    const user = await User_1.default.findOne({ email });
    if (!user) {
        throw new Error(`No user found for ${email}`);
    }
    user.role = "admin";
    user.role = role;
    await user.save();
    console.log(`${email} is now a ${role}`);
    process.exit(0);
};
run().catch((error) => {
    const message = error instanceof Error ? error.message : "Could not make admin";
    console.error(message);
    process.exit(1);
});
