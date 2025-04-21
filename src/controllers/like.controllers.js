import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { Like } from "../models/likes.models.js";
import { Comment } from "../models/comments.models.js";
import { Video } from "../models/video.models.js";
import { Tweet } from "../models/tweets.models.js";

// toggle like on a comment, video, or tweet
const toggleLike = asyncHandler(async (req, res) => {
    const { toggleLike, commentId, videoId, tweetId } = req.query

    if (!isValidObjectId(commentId) && !isValidObjectId(videoId) && !isValidObjectId(tweetId)) {
        throw new apiError(400, "Please provide a valid Id")
    }

    let reqLike;
    if (toggleLike === "true") reqLike = true;
    else if (toggleLike === "false") reqLike = false;
    else throw new apiError(400, "Invalid query string!!!");

    let userLike;

    if (commentId) {
        const comment = await Comment.findById(commentId);
        if (!comment) throw new apiError(400, "No comment found");

        userLike = await Like.find({
            comment: commentId,
            likedby: req.user?._id,
        });
    } else if (videoId) {
        const video = await Video.findById(videoId);
        if (!video) throw new apiError(400, "No video found");

        userLike = await Like.find({
            video: videoId,
            likedby: req.user?._id,
        });
    } else if (tweetId) {
        const tweet = await Tweet.findById(tweetId);
        if (!tweet) throw new apiError(400, "No tweet found");

        userLike = await Like.find({
            tweet: tweetId,
            likedby: req.user?._id,
        });
    }

    let isLiked = false;
    let isDisLiked = false;

    if (userLike?.length > 0) {
        // entry is present so toggle status
        if (userLike[0].liked) {
            // like is present
            if (reqLike) {
                // toggle like so delete like
                await Like.findByIdAndDelete(userLike[0]._id);
                isLiked = false;
                isDisLiked = false;
            } else {
                // toggle dis-like so make it dislike
                userLike[0].liked = false;
                let res = await userLike[0].save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = false;
                isDisLiked = true;
            }
        } else {
            // dis-like is present
            if (reqLike) {
                // toggle like so make it like
                userLike[0].liked = true;
                let res = await userLike[0].save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = true;
                isDisLiked = false;
            } else {
                // toggle dis-like so delete dis-like
                await Like.findByIdAndDelete(userLike[0]._id);
                isLiked = false;
                isDisLiked = false;
            }
        }
    } else {
        // entry is not present so create new
        let like;
        if (commentId) {
            like = await Like.create({
                comment: commentId,
                likedby: req.user?._id,
                liked: reqLike,
            });
        } else if (videoId) {
            like = await Like.create({
                video: videoId,
                likedby: req.user?._id,
                liked: reqLike,
            });
        } else if (tweetId) {
            like = await Like.create({
                tweet: tweetId,
                likedby: req.user?._id,
                liked: reqLike,
            });
        }
        if (!like) throw new apiError(500, "error while toggling like");
        isLiked = reqLike;
        isDisLiked = !reqLike;
    }

    let totalDisLikes, totalLikes;

    if (commentId) {
        totalLikes = await Like.find({ comment: commentId, liked: true });
        totalDisLikes = await Like.find({ comment: commentId, liked: false });
    } else if (videoId) {
        totalLikes = await Like.find({ video: videoId, liked: true });
        totalDisLikes = await Like.find({ video: videoId, liked: false });
    } else if (tweetId) {
        totalLikes = await Like.find({ tweet: tweetId, liked: true });
        totalDisLikes = await Like.find({ tweet: tweetId, liked: false });
    }

    return res.status(200).json(
        new apiResponse(
            200,
            {
                isLiked,
                totalLikes: totalLikes.length,
                isDisLiked,
                totalDisLikes: totalDisLikes.length,
            },
            "Like toggled successfully"
        )
    );

})

//TODO: toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { toggleLike } = req.query

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid video ID")
    }
    const video = await Video.findById(videoId)
    if (!video) {
        throw new apiError(404, "No video found for this video ID")
    }

    let reqLike;
    if(toggleLike === "true") reqLike = true
    else if(toggleLike === "false") reqLike = false
    else throw new apiError(400, "Invalid query string!!!")

    const likedAlready = await Like.findOne({
        video: videoId,
        likedby: req.user?._id
    })

    // console.log("likedAlready", likedAlready);

    let isLiked = false
    let isDisLiked = false


    // if (likedAlready) {
    //     await Like.findByIdAndDelete(likedAlready?._id)
    //     isLiked = false
    // } else {
    //     const like = await Like.create({
    //         video: videoId,
    //         likedby: req.user?._id
    //     })
    //     if (!like) throw new apiError(500, "error while toggling like")
    //     isLiked = true
    // }

    // get total likes
    
    if(likedAlready) {
        // entry is present so toggle status
        if (likedAlready.liked) {
            // like is present
            if (reqLike) {
                // toggle like so delete like
                await Like.findByIdAndDelete(likedAlready._id);
                isLiked = false;
                isDisLiked = false;
            } else {
                // toggle dis-like so make it dislike
                likedAlready.liked = false;
                let res = await likedAlready.save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = false;
                isDisLiked = true;
            }
        } else {
            // dis-like is present
            if (reqLike) {
                // toggle like so make it like
                likedAlready.liked = true;
                let res = await likedAlready.save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = true;
                isDisLiked = false;
            } else {
                // toggle dis-like so delete dis-like
                await Like.findByIdAndDelete(likedAlready._id);
                isLiked = false;
                isDisLiked = false;
            }
        }
    } else {
        // entry is not present so create new
        const like = await Like.create({
            video: videoId,
            likedby: req.user?._id,
            liked: reqLike,
        });
        if (!like) throw new apiError(500, "error while toggling like");
        isLiked = reqLike;
        isDisLiked = !reqLike;
    }
    
    const totalLikes = await Like.countDocuments({
        video: videoId,
        liked: true
    })
    const totalDisLikes = await Like.countDocuments({
        video: videoId,
        liked: false
    })

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            {
                isLiked,
                totalLikes,
                isDisLiked,
                totalDisLikes
            },
            "Like toggled successfully"
        )
    )
})

//TODO: toggle like on comment
const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { toggleLike } = req.query
    if (!isValidObjectId(commentId)) {
        throw new apiError(400, "Invalid comment ID")
    }

    const comment = await Comment.findById(commentId)
    if (!comment) {
        throw new apiError(404, "No comment found for this comment ID")
    }

    let reqLike;
    if (toggleLike === "true") reqLike = true
    else if (toggleLike === "false") reqLike = false
    else throw new apiError(400, "Invalid query string!!!")

    const likedAlready = await Like.findOne({
        comment: commentId,
        likedby: req.user?._id
    })

    console.log("likedAlready", likedAlready);

    let isLiked = false
    let isDisLiked = false

    if(likedAlready){
        if(likedAlready.liked){
            if(reqLike){
                await Like.findByIdAndDelete(likedAlready._id);
                isLiked = false;
                isDisLiked = false;
            } else {
                likedAlready.liked = false;
                let res = await likedAlready.save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = false;
                isDisLiked = true;
            }
        } else {
            if(reqLike){
                likedAlready.liked = true;
                let res = await likedAlready.save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = true;
                isDisLiked = false;
            } else {
                await Like.findByIdAndDelete(likedAlready._id);
                isLiked = false;
                isDisLiked = false;
            }
        }
    } else {
        const like = await Like.create({
            comment: commentId,
            likedby: req.user?._id,
            liked: reqLike,
        });
        if (!like) throw new apiError(500, "error while toggling like");
        isLiked = reqLike;
        isDisLiked = !reqLike;
    }

    const totalLikes = await Like.countDocuments({
        comment: commentId,
        liked: true
    })
    const totalDisLikes = await Like.countDocuments({
        comment: commentId,
        liked: false
    })

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            {
                isLiked,
                totalLikes,
                isDisLiked,
                totalDisLikes
            },
            "Like toggled successfully"
        )
    )

})

//TODO: toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    const { toggleLike } = req.query
    if (!isValidObjectId(tweetId)) {
        throw new apiError(400, "Invalid tweet ID")
    }

    const tweet = await Tweet.findById(tweetId)
    if (!tweet) {
        throw new apiError(404, "No tweet found for this tweet ID")
    }

    let reqLike;
    if (toggleLike === "true") reqLike = true
    else if (toggleLike === "false") reqLike = false
    else throw new apiError(400, "Invalid query string!!!")

    const likedAlready = await Like.findOne({
        tweet: tweetId,
        likedby: req.user?._id
    })

    console.log("likedAlready", likedAlready);

    let isLiked = false
    let isDisLiked = false

    if(likedAlready){
        if(likedAlready.liked){
            if(reqLike){
                await Like.findByIdAndDelete(likedAlready._id);
                isLiked = false;
                isDisLiked = false;
            } else {
                likedAlready.liked = false;
                let res = await likedAlready.save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = false;
                isDisLiked = true;
            }
        } else {
            if(reqLike){
                likedAlready.liked = true;
                let res = await likedAlready.save();
                if (!res) throw new apiError(500, "error while updating like");
                isLiked = true;
                isDisLiked = false;
            } else {
                await Like.findByIdAndDelete(likedAlready._id);
                isLiked = false;
                isDisLiked = false;
            }
        }
    } else {
        const like = await Like.create({
            tweet: tweetId,
            likedby: req.user?._id,
            liked: reqLike,
        });
        if (!like) throw new apiError(500, "error while toggling like");
        isLiked = reqLike;
        isDisLiked = !reqLike;
    }

    const totalLikes = await Like.countDocuments({
        tweet: tweetId,
        liked: true
    })

    const totalDisLikes = await Like.countDocuments({
        tweet: tweetId,
        liked: false
    })

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            {
                isLiked,
                totalLikes,
                isDisLiked,
                totalDisLikes
            },
            "Like toggled successfully"
        )
    )
}
)

//TODO: get all liked videos
const getLikedVideos = asyncHandler(async (req, res) => {
    // const likedVideos = await Like.find({
    //     likedby: req.user?._id,
    //     video: { $ne: null }
    // }).populate("video").sort({ createdAt: -1 })

    // if (!likedVideos) {
    //     return res.status(200).json(
    //         new apiResponse(
    //             200,
    //             [],
    //             "No liked videos found"
    //         )
    //     )
    // }
    // return res.status(200).json(
    //     new apiResponse(
    //         200,
    //         likedVideos,
    //         "Liked videos fetched successfully"
    //     )
    // )

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedby: new mongoose.Types.ObjectId(req.user?._id),
                video: { $ne: null}
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
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
                                        avatar: 1,
                                        username: 1
                                    }
                                }
                            ]
                        }
                    },
                    { $unwind: "$owner" },
                ]
            }
        },
        { $unwind: "$video" },
        {
            $match: {
                "video.isPublished": true
            }
        },
        {
            $group: {
                _id: "$likedby",
                videos: { $push: "$video" },
            }
        }
    ])

    // console.log("likedVideos", likedVideos);
    // console.log("likedVideos[0]", likedVideos[0]);

    const videos = likedVideos[0]?.videos || []

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            videos,
            "Liked videos fetched successfully"
        )
    )
})

export {
    toggleLike,
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}