import mongoose from "mongoose"
import { Video } from "../models/video.models.js"
import { Subscription } from "../models/subscriptions.models.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

// TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
const getChannelStats = asyncHandler(async (req, res) => {
    
    const videoStats = await Video.aggregate([
        {
            $match: {
                owner: req.user?._id
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $project: {
                totalLikes: {
                    $size: "$likes"
                },
                totalViews: "$views",
                totalVideos: 1
            }
        },
        {
            $group: {
                _id: null,
                totalLikes: {
                    $sum: "$totalLikes"
                },
                totalViews: {
                    $sum: "$totalViews"
                },
                totalVideos: {
                    $sum: 1
                }
            }
        }
    ])

    const subscribersCount = await Subscription.aggregate([
        {
            $match: {
                channel: req.user?._id
            }
        },
        {
            $group: {
                _id: null,
                subscribersCount: {
                    $sum: 1
                }
            }
        }
    ])

    const channelStats = {
        ownerName: req.user?.fullName,
        totalLikes: videoStats[0]?.totalLikes || 0,
        totalViews: videoStats[0]?.totalViews || 0,
        totalVideos: videoStats[0]?.totalVideos || 0,
        subscribersCount: subscribersCount[0]?.subscribersCount || 0
    }

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            channelStats,
            "Channel stats fetched successfully",
        )
    )
})

// TODO: Get all the videos uploaded by the channel
const getChannelVideos = asyncHandler(async (req, res) => {
    
    const videos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        // lookup for likes
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes",
                pipeline: [
                    {
                        $match: {
                            liked: true
                        }
                    }
                ]
            }
        },
        // lookup for dislikes
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "dislikes",
                pipeline: [
                    {
                        $match: {
                            liked: false
                        }
                    }
                ]
            }
        },
        // lookup for comments
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                videoFile: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                totalLikes: {
                    $size: "$likes"
                },
                totalDisLikes: {
                    $size: "$dislikes"
                },
                commentsCount: {
                    $size: "$comments"
                }
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            videos,
            "Videos fetched successfully",
        )
    )
})

export {
    getChannelStats,
    getChannelVideos
}