import mongoose from "mongoose";

export interface IBranch extends mongoose.Document {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const branchSchema = new mongoose.Schema<IBranch>(
  {
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

branchSchema.index({ isActive: 1, createdAt: -1 });
branchSchema.index({ createdAt: -1 });

const Branch = mongoose.model<IBranch>("Branch", branchSchema);
export default Branch;
