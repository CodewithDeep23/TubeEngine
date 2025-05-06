import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import { deleteOldImagesFromCloudinary, getPublicIdFromUrl } from "../utils/deleteOldCloudinaryFile.js";
import mongoose from "mongoose";

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
            $unset: {
                refreshToken: 1 // This remvoe the field from the document, we use $unset instead of $set
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
    
        const user = await User.findById(decodedToken._id)
    
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


// Change Password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body

    // Check for user
    const user = await User.findById(req.user._id)

    // Check for password
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new apiError(401, "Old password is incorrect")
    }

    // Update password
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new apiResponse(200, {}, "Password updated successfully")
    )
})


// Current User
const currentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new apiResponse(200, req.user, "User found successfully")
    )
})

// Update account details (text base data)
const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, newEmail, newUsername} = req.body

    // check for empty fields
    if(!fullName || !newEmail || !newUsername){
        throw new apiError(400, "All fields are required")
    }

    // Check for user and update
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: newEmail,
                username: newUsername.toLowerCase()
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Account details updated successfully")
    )
})

// Upload avatar image
const avatarUpload = asyncHandler(async (req, res) => {
    // check for avatar image
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new apiError(400, "Avatar image is missing")
    }

    // check for old avatar image
    const oldAvatar = await User.findById(req.user?._id).select("avatar -_id")
    console.log(oldAvatar.avatar);

    // Upload to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new apiError(400, "Error while uploading avatar image")
    }

    // Update user avatar in DB
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    // delete old avatar image from cloudinary
    if (oldAvatar.avatar) {
        const oldPublicId = await getPublicIdFromUrl(oldAvatar.avatar);
        await deleteOldImagesFromCloudinary(oldPublicId);
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Avatar image updated successfully")	
    )
})

// Upload cover image
const coverImageUpload = asyncHandler(async (req, res) => {
    // check for avatar image
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new apiError(400, "Cover image is missing")
    }

    // Upload to cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new apiError(400, "Error while uploading cover image")
    }

    // Update user avatar in DB
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Cover image updated successfully")
    )
})

// get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
    // get username from req.params (url)
    const {username} = req.params

    if(!username?.trim()){
        throw new apiError(400, "Username is missing")
    }

    // first find user and join with channel
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        // basically we find out user, now we check how many subscribers you have?
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        // Now we check, How many channel are you subscribed to?
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                channelsSubscribedToCount: { $size: "$subscribedTo" },
                // check you subscribed to this channel or not
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        // remove unwanted fields
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                email: 1
            }
        }
    ])

    // check if channel is found or not
    if(!channel?.length){
        throw new apiError(404, "Channel not found")
    }
    
    return res
    .status(200)
    .json(
        new apiResponse(200, channel[0], "User channel profile found successfully")
    )
})

// Get watch history
const getWatchHistory = asyncHandler(async (req, res) => {
    // get user from req.user
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200, 
            user[0]?.watchHistory, 
            "Watch history found successfully")
    )
})

// Delete watch history
const clearWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: { watchHistory: [] }
    }, { new: true });

    if (!user) throw new apiError(400, "User not found");

    return res
    .status(200)
    .json(
        200,
        user?.watchHistory,
        "Watched History deleted successfully!"
    );
});


export {
    registerUser, 
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    currentUser,
    updateAccountDetails,
    avatarUpload,
    coverImageUpload,
    getUserChannelProfile,
    getWatchHistory,
    clearWatchHistory
}