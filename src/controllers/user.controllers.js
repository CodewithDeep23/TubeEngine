import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler( async (req, res) => {
    // res.status(200).json({
    //     message: "ok"
    // })

    // Get users details from Frontend/Postman
    const {username, email, fullName, password} = req.body
    console.log("email: ", email);

    // ⁡⁢⁣⁢Validation - Not Empty
    /* if(fullName === ""){
         throw new apiError(400, "Full Name is required")
    } */

    if (
        [username, email, fullName, password].some((field) => 
        field?.trim() === "")
    ){
        throw new apiError(400, "Alls fields are required")
    }

    // Check users already exists: Username or Email
    const existedUser = User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser){
        throw new apiError(409, "User with username or email already exists")
    }

    // Check for images, check for avatar
    // req.files: use optionaly for better practice 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is required")
    }
    
    // Upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
    if(!avatar){
        throw new apiError(400, "Avatar file is required")
    }

    // Create user object - create entry in DB
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // Remove password & refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // Check for user creation
    if(!createdUser){
        throw new apiError(500, "Something went wrong while regitering the user")
    }

    // return res
    return res.status(200).json(
        new apiResponse(201, createdUser, "User registered successfully")
    )
})

export {registerUser}