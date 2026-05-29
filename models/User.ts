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

export type OrderStatus = "pending" | "paid" | "completed" | "cancelled";

interface Order {
  _id?: mongoose.Types.ObjectId;
  items: OrderItem[];
  totalItems: number;
  totalAmount: number;
  paymentMode: "online" | "jazzcash";
  status: OrderStatus;
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

interface FavoriteItem {
  _id?: mongoose.Types.ObjectId;
  productId: string;
  name: string;
  price: string;
  image: string;
  desc?: string;
  category?: string;
  createdAt: Date;
}

export interface DeliveryAddress {
  id: string;
  type: "home" | "office";
  locationName: string;
  latitude: number;
  longitude: number;
  house: string;
  street: string;
  landmark: string;
}

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin" | "superadmin";
  refreshToken?: string;
  bucket: BucketItem[];
  orders: Order[];
  favorites: FavoriteItem[];
  addresses: DeliveryAddress[];
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
          enum: ["pending", "paid", "completed", "cancelled"],
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
    favorites: [
      {
        productId: String,
        name: String,
        price: String,
        image: String,
        desc: String,
        category: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    addresses: [
      {
        id: String,
        type: {
          type: String,
          enum: ["home", "office"],
        },
        locationName: String,
        latitude: Number,
        longitude: Number,
        house: String,
        street: String,
        landmark: String,
      },
    ],
  },
  { timestamps: true },
);

userSchema.index({ "orders.createdAt": -1 });
userSchema.index({ "favorites.productId": 1 });

const User = mongoose.model<IUser>("User", userSchema);
export default User;
