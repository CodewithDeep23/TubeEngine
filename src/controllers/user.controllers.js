import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken()

        // save refresh token in database
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken, refreshToken}
    } catch (error) {
        throw new apiError(500, "Something went wrong while generating access token and refresh token")
    }
}

// Register User
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
    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser){
        throw new apiError(409, "User with username or email already exists")
    }

    console.log(req.files);
    // Check for images, check for avatar
    // req.files: use optionaly for better practice 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    // check if the files are arrived or not
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

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

// Login
const loginUser = asyncHandler(async (req, res) => {

    // fetch data from req.body
    const {username, email, password} = req.body
    console.log(username);
    // Check empty
    if(!username && !email){
        throw new apiError(400, "username or email is required")
    }
    // Login by username or email
    // Find user
    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    
    if(!user){
        throw new apiError(400, "User does not exist")
    }

    // Check password
    const isPasswordvalid = await user.isPasswordCorrect(password)

    if(!isPasswordvalid){
        throw new apiError(401, "Password incorrect")
    }

    // Generate A_token and R_token
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    // Send these token via secure cookies
    // again queary -> can make a expensive call
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // secure cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    // --> by default your cookies can be modified via frontend. But if you give the true value for these keys then no one can modify yours keys

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new apiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged In Successfully"
        )
    )

})

// Logout
const logoutUser = asyncHandler(async (req, res) => {
    // Get user from req, 
    // (1) verifyJWT middleware
    // (2) get user from req.user
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    // new: true - return the updated document

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new apiResponse(200, {}, "User logged Out")
    )

})

// Refresh Token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new apiError(401, "Unauthorized access")
    }

    try {
        // Verify refresh token
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id).select("-password -refreshToken")
    
        if(!user){
            throw new apiError(402, "Invalid Refresh Token")
        }
    
        if(user.refreshToken !== incomingRefreshToken){
            throw new apiError(402, "Refresh token is expired")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new apiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new apiError(401, error?.message || "Ivalid refresh token")
    }
})

export {
    registerUser, 
    loginUser,
    logoutUser,
    refreshAccessToken
}