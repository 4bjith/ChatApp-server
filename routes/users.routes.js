import express from "express";
import { requestOTP, verifyOTP, getMe, logout, getAllUsers, updateUser, deleteUser, getUserById } from "../controllers/users.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Define routes for user-related operations
router.post("/request-otp", requestOTP);
router.get("/me", verifyToken, getMe);
router.post("/verify-otp", verifyOTP);
router.post("/logout", verifyToken, logout);
router.get("/", verifyToken, getAllUsers);
router.get("/:id", verifyToken, getUserById);
router.put("/", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);



export default router;