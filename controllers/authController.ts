import type { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

interface AuthRequestBody {
  name?: string;
  email: string;
  password: string;
}

interface TokenPayload {
  id: string;
}

const ACCESS_TOKEN_COOKIE_NAME = "refreshToken";
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

const getAccessSecret = () => {
  return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
};

const getRefreshSecret = () => {
  return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
};

//Generate access token
const generateAccessToken = (id: string) => {
  const secret = getAccessSecret();
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not defined");
  }
  return jwt.sign({ id }, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
  });
};

//Generate refresh token

const generateRefreshToken = (id: string) => {
  const secret = getRefreshSecret();
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not defined");
  }
  return jwt.sign({ id }, secret, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
  });
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Something went wrong";
};

// function converts a raw cookie string into a JS object.
const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) {
      return acc;
    }

    acc[rawName] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
};

// get refresh token from incoming request's cookie
const getRefreshTokenFromRequest = (req: Request) => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[ACCESS_TOKEN_COOKIE_NAME];
};

//This stores refresh token in browser cookie.
const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie(ACCESS_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });
};

const buildAuthResponse = (user: {
  _id: unknown;
  name: string;
  email: string;
  role: "user" | "admin" | "superadmin";
  addresses?: any[];
}) => {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    addresses: user.addresses || [],
    accessToken: generateAccessToken(String(user._id)),
  };
};

//This stores refresh token in database.
const persistRefreshToken = async (userId: string, refreshToken: string) => {
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
  await User.findByIdAndUpdate(userId, { refreshToken: hashedRefreshToken });
};

export const signup = async (
  req: Request<unknown, unknown, AuthRequestBody>,
  res: Response,
) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
    });

    const refreshToken = generateRefreshToken(String(user._id));
    await persistRefreshToken(String(user._id), refreshToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.json(buildAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const login = async (
  req: Request<unknown, unknown, AuthRequestBody>,
  res: Response,
) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      const refreshToken = generateRefreshToken(String(user._id));
      await persistRefreshToken(String(user._id), refreshToken);
      setRefreshTokenCookie(res, refreshToken);

      return res.json(buildAuthResponse(user));
    }

    return res.status(401).json({ message: "Invalid credentials" });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

// create a new access token using refresh token.
export const refresh = async (req: Request, res: Response) => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  const secret = getRefreshSecret();
  if (!secret) {
    return res.status(500).json({ message: "JWT refresh secret is not configured" });
  }

  try {
    const decoded = jwt.verify(refreshToken, secret) as TokenPayload;
    const user = await User.findById(decoded.id).lean();

    if (!user || !user.refreshToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const isValidToken = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValidToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    //generate new access token and save it in browser cookie
    const nextRefreshToken = generateRefreshToken(String(user._id));
    await persistRefreshToken(String(user._id), nextRefreshToken);
    setRefreshTokenCookie(res, nextRefreshToken);

    return res.json(buildAuthResponse(user));
  } catch (_error) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};

export const logout = async (req: Request, res: Response) => {
  const refreshToken = getRefreshTokenFromRequest(req);
  const secret = getRefreshSecret();

  if (refreshToken && secret) {
    try {
      const decoded = jwt.verify(refreshToken, secret) as TokenPayload;
      await User.findByIdAndUpdate(decoded.id, { $unset: { refreshToken: 1 } });
    } catch (_error) {
      // Ignore invalid refresh tokens during logout and still clear the cookie.
    }
  }

  clearRefreshTokenCookie(res);
  return res.json({ message: "Logged out successfully" });
};

export const addAddress = async (
  req: AuthenticatedRequest<any, any, any>,
  res: Response,
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { id, type, locationName, latitude, longitude, house, street, landmark } = req.body;

    if (!id || !type || !locationName || !house || !street || !landmark) {
      return res.status(400).json({ message: "Missing required address fields" });
    }

    const newAddress = {
      id,
      type,
      locationName,
      latitude,
      longitude,
      house,
      street,
      landmark,
    };

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $push: { addresses: { $each: [newAddress], $position: 0 } } },
      { new: true, projection: { addresses: 1 } },
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Address added successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getAddresses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(req.userId).select("addresses").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      addresses: user.addresses || [],
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const deleteAddress = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Address ID is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $pull: { addresses: { id } } },
      { new: true, projection: { addresses: 1 } },
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Address deleted successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};
