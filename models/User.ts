import mongoose from "mongoose";

interface BucketItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface OrderItem {
  _id?: mongoose.Types.ObjectId;
  productId: string;
  name: string;
  unitPrice: string;
  quantity: number;
  image: string;
}

interface Order {
  _id?: mongoose.Types.ObjectId;
  items: OrderItem[];
  totalItems: number;
  totalAmount: number;
  paymentMode: "online" | "jazzcash";
  status: "pending" | "paid";
  orderId: string;
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
}

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin" | "superadmin";
  refreshToken?: string;
  bucket: BucketItem[];
  orders: Order[];
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    password: String,
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    refreshToken: String,
    bucket: [
      {
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String,
      },
    ],
    orders: [
      {
        items: [
          {
            productId: String,
            name: String,
            unitPrice: String,
            quantity: Number,
            image: String,
          },
        ],
        totalItems: Number,
        totalAmount: Number,
        paymentMode: {
          type: String,
          enum: ["online", "jazzcash"],
        },
        status: {
          type: String,
          enum: ["pending", "paid"],
          default: "paid",
        },
        orderId: {
          type: String,
          unique: true,
          sparse: true,
        },
        deliveryAddress: {
          house: String,
          street: String,
          landmark: String,
        },
        customerInfo: {
          name: String,
          email: String,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;
