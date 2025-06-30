import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js";
import { Comment } from "../models/comments.models.js";
import { Video } from "../models/video.models.js";
import { Like } from "../models/likes.models.js";

//TODO: get all comments for a video
const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid video ID")
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new apiError(404, "No video found for this video ID")
    }

    const comments = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        // fetch likes of the comment
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
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
                            owners: {
                                $push: "$likedby"
                            },
                        }
                    }
                ]
            }
        },
        // fetch dislikes of the comment
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
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
                            owners: {
                                $push: "$likedby"
                            },
                        }
                    }
                ]
            }
        },
        // Reshape likes and dislikes
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
                            _id: 1,
                            fullName: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        { $unwind: "$owner" },
        {
            $project: {
                content: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1,
                isOwner: {
                    $cond: {
                        if: { $eq: [req.user?._id, "$owner._id"] },
                        then: true,
                        else: false
                    }
                },
                likesCount: { $size: "$likes" },
                dislikesCount: { $size: "$dislikes" },
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
                isLikedbyVideoOwner: {
                    $cond: {
                        if: { $in: [video.owner, "$likes"] },
                        then: true,
                        else: false
                    }
                }
            }
        }
    ])

    // Send paginated comments
    const paginatedComments = await Comment.aggregatePaginate(comments, options)

    return res
        .status(200)
        .json(
            new apiResponse(
                200,
                paginatedComments,
                "Comments fetched successfully"
            )
        )

})

// TODO: add a comment to a video
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body
    console.log("req.body", req.body);

    if(!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid video ID")
    }
    const video = await Video.findById(videoId)
    if(!video) {
        throw new apiError(404, "No video found for this video ID")
    }

    if(!content) {
        throw new apiError(400, "Content is not found")
    }

    // create comment
    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    })

    if(!comment) {
        throw new apiError(500, "Comment not created")
    }

    const { username, fullName, avatar, _id } = req.user

    const commentDetails = {
        ...comment._doc,
        owner: {
            _id,
            username,
            fullName,
            avatar
        },
        isOwner: true,
        likesCount: 0,
        dislikesCount: 0
    }

    return res
    .status(201)
    .json(
        new apiResponse(
            201,
            commentDetails,
            "Comment created successfully"
        )
    )
})

// TODO: update a comment
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body
    if(!isValidObjectId(commentId)) {
        throw new apiError(400, "Invalid comment ID")
    }
    if(!content) {
        throw new apiError(400, "Content is not found")
    }

    const comment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content
            }
        },
        {
            new: true
        }
    )

    if(!comment) {
        throw new apiError(404, "Comment not found")
    }

    const { username, fullName, avatar, _id } = req.user

    const commentDetails = {
        ...comment._doc,
        owner: {
            _id,
            username,
            fullName,
            avatar
        },
        isOwner: true,
        likesCount: 0,
        dislikesCount: 0
    }

    return res
    .status(201)
    .json(
        new apiResponse(
            201,
            commentDetails,
            "Comment updated successfully"
        )
    )
})

// TODO: delete a comment
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    if(!isValidObjectId(commentId)) {
        throw new apiError(400, "Invalid comment ID")
    }

    const comment = await Comment.findByIdAndDelete(commentId)

    if(!comment) {
        throw new apiError(404, "Error while deleting comment")
    }

    // only delete the comment if the user is the owner of the comment
    if(comment?.owner.toString() !== req.user?._id.toString()) {
        throw new apiError(403, "You are not allowed to delete this comment")
    }

    // delete all likes for the comment
    const deleteLikes = await Like.deleteMany({
        comment: new mongoose.Types.ObjectId(commentId)
    })

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            { isDeleted: true },
            "Comment deleted successfully"
        )
    )
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}
