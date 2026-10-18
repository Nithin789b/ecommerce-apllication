import mongoose from "mongoose";

const userschema=mongoose.Schema({
    username:{
        type:String,
        
    },
    email:{
        type:String,
        required:true,
        trim:true,
        lowercase:true
    },
    phone_number:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN"],
        default: "USER",
        required: true
    },
    otp:{
        type:String,
        default: null
    },
    refreshTokenHash: {
        type: String,
        default: null,
        select: false
    }
},{
    timestamps:true
});
const userModel=mongoose.model("User",userschema);
export default userModel;
