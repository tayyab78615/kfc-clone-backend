import mongoose from "mongoose";

type MenuCategory =
  | "explore"
  | "bestseller"
  | "topdeals"
  | "promotions"
  | "everydayvalue"
  | "alacarte"
  | "signatureboxes"
  | "sharing";

export interface IMenuItem extends mongoose.Document {
  name: string;
  price: string;
  desc?: string;
  imageUrl: string;
  category: MenuCategory;
  createdAt?: Date;
  updatedAt?: Date;
}

const menuItemSchema = new mongoose.Schema<IMenuItem>(
  {
    name: { type: String, required: true },
    price: { type: String, required: true },
    desc: { type: String },
    imageUrl: { type: String, default: "" },
    category: {
      type: String,
      enum: [
        "explore",
        "bestseller",
        "topdeals",
        "promotions",
        "everydayvalue",
        "alacarte",
        "signatureboxes",
        "sharing",
      ],
      required: true,
    },
  },
  { timestamps: true },
);

const MenuItem = mongoose.model<IMenuItem>("MenuItem", menuItemSchema);
export default MenuItem;
