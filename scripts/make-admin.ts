import dotenv from "dotenv";
import connectDB from "../config/db";
import User from "../models/User";

dotenv.config();

const email = process.argv[2]?.trim().toLowerCase();
const roleArg = process.argv[3]?.trim().toLowerCase();
const role = roleArg === "superadmin" ? "superadmin" : "admin";

const run = async () => {
  if (!email) {
    throw new Error(
      "Usage: npm run make-admin -- user@example.com [superadmin]",
    );
  }

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(`No user found for ${email}`);
  }

  user.role = "admin";
  user.role = role;
  await user.save();

  console.log(`${email} is now a ${role}`);
  process.exit(0);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Could not make admin";
  console.error(message);
  process.exit(1);
});
