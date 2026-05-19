import express from "express";
import {
  signup,
  login,
  refresh,
  logout,
} from "../controllers/authController";

const router = express.Router();

//This route creates a new user (sign up)
router.post("/signup", signup);
//This route authenticates existing users (log in)
router.post("/login", login);
//This route issues a new access token when the current one expires
router.post("/refresh", refresh);
//This route logs out the user by clearing the refresh token
router.post("/logout", logout);

export default router;
