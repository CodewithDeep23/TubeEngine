import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweets.models.js"
import { User } from "../models/user.models.js"
import { apiError } from "../utils/apiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { apiResponse } from "../utils/apiResponse.js"
import { Like } from "../models/likes.models.js"
import { Subscription } from "../models/subscriptions.models.js"

//TODO: create tweet
const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body

    if (!content) {
        throw new apiError(400, "Please provide a tweet")
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user?._id
    })

    if (!tweet) {
        throw new apiError(500, "Tweet not created")
    }

    // populate tweet with user details
    const newTweet = {
        ...tweet?._doc,
        owner: {
            username: req.user.username,
            fullName: req.user.fullName,
            avatar: req.user.avatar
        },
        totalLikes: 0,
        totalDislikes: 0,
        isLiked: false,
        isDisliked: false,
    }

    return res
        .status(201)
        .json(
            new apiResponse(
                201,
                newTweet,
                "Tweet created successfully"
            )
        )
})

// TODO: get user tweets
const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params
    if (!isValidObjectId(userId)) {
        throw new apiError(400, "Invalid user ID")
    }

    const user = await User.findById(userId)
    if (!user) {
        throw new apiError(404, "No user found for this ID")
    }

    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        // owner details
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$owner"
        },
        // likes of the tweet
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes",
                pipeline: [
                    {
                        $match: {
                            liked: true
                        }
                    },
                    {
                        $group: {
                            _id: "liked",
                            owners: { $push: "$likedby" }
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "dislikes",
                pipeline: [
                    {
                        $match: {
                            liked: false
                        }
                    },
                    {
                        $group: {
                            _id: "liked",
                            owners: { $push: "$likedby" }
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likes: {
                    $cond: {
                        if: { $gt: [{ $size: "$likes" }, 0] },
                        then: { $first: "$likes.owners" },
                        else: []
                    }
                },
                dislikes: {
                    $cond: {
                        if: { $gt: [{ $size: "$dislikes" }, 0] },
                        then: { $first: "$dislikes.owners" },
                        else: []
                    }
                }
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                updatedAt: 1,
                owner: 1,
                totalLikes: { $size: "$likes" },
                totalDislikes: { $size: "$dislikes" },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes"] },
                        then: true,
                        else: false
                    }
                },
                isDisliked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$dislikes"] },
                        then: true,
                        else: false
                    }
                },
                isOwner: {
                    $cond: {
                        if: { $eq: [req.user?._id, "$owner._id"] },
                        then: true,
                        else: false
                    }
                }
            }
        }
    ])

    if (!tweets) {
        throw new apiError(404, "No tweets found for this user")
    }

    return res
        .status(200)
        .json(
            new apiResponse(
                200,
                tweets,
                "Tweets fetched successfully"
            )
        )
})

//TODO: update tweet
const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    const { content } = req.body

    if (!isValidObjectId(tweetId)) {
        throw new apiError(400, "Invalid tweet ID")
    }
    if (!content) {
        throw new apiError(400, "Please provide a tweet")
    }

    const tweet = await Tweet.findById(tweetId)
    if (!tweet) {
        throw new apiError(404, "No tweet found for this ID")
    }

    if (tweet?.owner.toString() !== req.user?._id.toString()) {
        throw new apiError(403, "You are not allowed to update this tweet")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content
            }
        },
        {
            new: true
        }
    )

    if (!updatedTweet) {
        throw new apiError(500, "Tweet not updated")
    }

    return res
        .status(200)
        .json(
            new apiResponse(
                200,
                updatedTweet,
                "Tweet updated successfully"
            )
        )
})

//TODO: delete tweet
const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new apiError(400, "Invalid tweet ID")
    }

    const tweet = await Tweet.findById(tweetId)
    if (!tweet) {
        throw new apiError(404, "No tweet found for this ID")
    }

    if (tweet?.owner.toString() !== req.user?._id.toString()) {
        throw new apiError(403, "You are not allowed to delete this tweet")
    }

    const deletedTweet = await Tweet.findByIdAndDelete(tweetId)

    if (!deletedTweet) {
        throw new apiError(500, "Tweet not deleted")
    }

    // also delete the likes and dislikes of the tweet
    await Like.deleteMany(
        {
            tweet: new mongoose.Types.ObjectId(tweetId)
        }
    )

    return res
        .status(200)
        .json(
            new apiResponse(
                200,
                deletedTweet,
                "Tweet deleted successfully"
            )
        )
})

// TODO: get all tweets of the user feed
const getAllUserFeedTweets = asyncHandler(async (req, res) => {
    const subscriptions = await Subscription.find({ subscriber: req.user?._id });

    const subscribedChannels = subscriptions.map((item) => item.channel);

    const allTweets = await Tweet.aggregate([
        {
            $match: {
                owner: {
                    $in: subscribedChannels,
                },
            },
        },
        // sort by latest
        {
            $sort: {
                createdAt: -1,
            },
        },
        // fetch likes of tweet
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes",
                pipeline: [
                    {
                        $match: {
                            liked: true,
                        },
                    },
                    {
                        $group: {
                            _id: "liked",
                            owners: { $push: "$likedby" },
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "dislikes",
                pipeline: [
                    {
                        $match: {
                            liked: false,
                        },
                    },
                    {
                        $group: {
                            _id: "liked",
                            owners: { $push: "$likedby" },
                        },
                    },
                ],
            },
        },
        // Reshape Likes and dislikes
        {
            $addFields: {
                likes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$likes" }, 0],
                        },
                        then: { $first: "$likes.owners" },
                        else: [],
                    },
                },
                dislikes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$dislikes" }, 0],
                        },
                        then: { $first: "$dislikes.owners" },
                        else: [],
                    },
                },
            },
        },
        // get owner details
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$owner",
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                updatedAt: 1,
                owner: 1,
                isOwner: {
                    $cond: {
                        if: { $eq: [req.user?._id, "$owner._id"] },
                        then: true,
                        else: false,
                    },
                },
                totalLikes: {
                    $size: "$likes",
                },
                totalDisLikes: {
                    $size: "$dislikes",
                },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes"],
                        },
                        then: true,
                        else: false,
                    },
                },
                isDisLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$dislikes"],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(new apiResponse(200, allTweets, "all tweets send successfully"));
});

// TODO: Get all tweets:
const getAllTweets = asyncHandler(async (req, res) => {
    const allTweets = await Tweet.aggregate([
        // sort by latest
        {
            $sort: {
                createdAt: -1,
            },
        },
        // fetch likes of tweet
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes",
                pipeline: [
                    {
                        $match: {
                            liked: true,
                        },
                    },
                    {
                        $group: {
                            _id: "liked",
                            owners: { $push: "$likedBy" },
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "dislikes",
                pipeline: [
                    {
                        $match: {
                            liked: false,
                        },
                    },
                    {
                        $group: {
                            _id: "liked",
                            owners: { $push: "$likedBy" },
                        },
                    },
                ],
            },
        },
        // Reshape Likes and dislikes
        {
            $addFields: {
                likes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$likes" }, 0],
                        },
                        then: { $first: "$likes.owners" },
                        else: [],
                    },
                },
                dislikes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$dislikes" }, 0],
                        },
                        then: { $first: "$dislikes.owners" },
                        else: [],
                    },
                },
            },
        },
        // get owner details
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$owner",
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                updatedAt: 1,
                owner: 1,
                isOwner: {
                    $cond: {
                        if: { $eq: [req.user?._id, "$owner._id"] },
                        then: true,
                        else: false,
                    },
                },
                totalLikes: {
                    $size: "$likes",
                },
                totalDisLikes: {
                    $size: "$dislikes",
                },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes"],
                        },
                        then: true,
                        else: false,
                    },
                },
                isDisLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$dislikes"],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(new apiResponse(200, allTweets, "all tweets send successfully"));
});


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    getAllUserFeedTweets,
    getAllTweets
}