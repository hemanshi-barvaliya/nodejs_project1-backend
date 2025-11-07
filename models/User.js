import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: 
    {
        type: String
    },
    email: 
    { 
        type: String, 
        unique: true 
    },
    password: 
    {
        type: String
    },
    otp: 
    {
        type: String
    },
    otpExpires: 
    {
        type: Date
    },
    isVerified: 
    { 
        type: Boolean, 
        default: false 
    },
    online: 
    { 
        type: Boolean, 
        default: false 
    },
    socketId: 
    { 
        type: String, 
        default: null 
    },
    image: {
        type: String,   
        default: "", 
    },
});

export default mongoose.model("User", userSchema);
