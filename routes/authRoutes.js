import express from "express";
import { 
    register, 
    verifyOtp, 
    login, 
    profile, 
    forgotPassword, 
    resetPassword 
} from "../controller/authController.js";
import { tokenprotect } from "../middleware/authToken.js";
import upload from "../middleware/upload.js";

const router = express.Router();
router.post("/register", upload.single("image"), register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.get("/profile", tokenprotect, profile);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
