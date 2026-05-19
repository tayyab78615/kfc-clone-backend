import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined");
    }
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database connection failed";
    console.log(message);
    process.exit(1);
  }
};

export default connectDB;
