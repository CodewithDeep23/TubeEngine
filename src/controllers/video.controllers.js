import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js";
import { Video } from "../models/video.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose, { isValidObjectId } from "mongoose";
import { stopWords } from "../utils/helperData.js"
import { deleteOldImagesFromCloudinary, deleteOldVideoFromCloudinary, getPublicIdFromUrl } from "../utils/deleteOldCloudinaryFile.js";

// get all video
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType = 'video', userId } = req.query;

    // get all videos based on query, sort, pagination
    // Initial filter: only published videos.
    const filter = { isPublished: true };

    // check if userId is provided and is a valid MongoDB ObjectId
    if (isValidObjectId(userId)) {
        filter.owner = new mongoose.Types.ObjectId(userId);
    }


    const pipeline = [
        {
            $match: { ...filter }
        }
    ]

    const sort = {};

    // Handle search query, if provided
    if (query) {
        const queryWords = query
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ")
            .split(" ");
        const filteredWords = queryWords.filter(
            (word) => !stopWords.includes(word)    // Removes common stop words (like "the", "a", "and", etc.)
        );

        console.log("query: ", query);
        console.log("filteredWords: ", filteredWords);

        // Match word count in title
        pipeline.push({
            $addFields: {
                titleMatchWordCount: {
                    $size: {
                        $filter: {
                            input: filteredWords,
                            as: "word",
                            cond: {
                                $in: ["$$word", { $split: [{ $toLower: "$title" }, " "] }],
                            },
                        },
                    },
                },
            },
        });

        // Match word count in description
        pipeline.push({
            $addFields: {
                descriptionMatchWordCount: {
                    $size: {
                        $filter: {
                            input: filteredWords,
                            as: "word",
                            cond: {
                                $in: [
                                    "$$word",
                                    { $split: [{ $toLower: "$description" }, " "] },
                                ],
                            },
                        },
                    },
                },
            },
        });

        sort.titleMatchWordCount = -1;
    }

    // sort the documents
    if (sortBy) {
        sort[sortBy] = parseInt(order);
    } else if (!query && !sortBy) {
        sort["createdAt"] = -1;
    }

    pipeline.push({
        $sort: {
            ...sort,
        },
    });

    // Join with the User collection to get the owner details
    pipeline.push(
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
                            fullName: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$owner",      // $unwind flattens the owner array into an object.
        }
    );

    // console.log("pipeline: ",pipeline);
    const videoAggregate = Video.aggregate(pipeline);
    // console.log("videoAggregate: ", videoAggregate);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const allVideos = await Video.aggregatePaginate(videoAggregate, options);
    // console.log(allVideos);

    const { docs, ...pagingInfo } = allVideos;

    return res
        .status(200)
        .json(
            new apiResponse(
                200,
                { videos: docs, pagingInfo },
                "All Videos fetched successfully"
            )
        );


});

// publish video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new apiError(400, "All fields are required");
    }

    // console.log("req.files",req.files);

    // fetch local video file path
    let videoFileLocalPath = null;
    if (req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0) {
        videoFileLocalPath = req.files.videoFile[0].path;
    }
    if (!videoFileLocalPath) {
        throw new apiError(400, "Video File not found");
    }

    // fetch local thumbnail file path
    let thumbnailLocalPath = null;
    if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnailLocalPath = req.files.thumbnail[0].path;
    }
    // const thumbnailLocalPath = req.files?.thumbnail[0].path;
    if (!thumbnailLocalPath) {
        throw new apiError(400, "Thumbnail File not found");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnailFile = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new apiError(500, "Error while Uploading Video File");
    }

    if (!thumbnailFile) {
        throw new apiError(500, "Error while uploading thumbnail file");
    }

    console.log("videoFile",videoFile);
    console.log("thumnailFile",thumbnailFile);

    const video = await Video.create({
        owner: req.user?._id,
        videoFile: videoFile.url,
        thumbnail: thumbnailFile.url,
        title,
        description: description || "",
        duration: videoFile.duration,
    });

    console.log("video: ", video)

    if (!video) {
        throw new apiError(500, "Error while Publishing Video");
    }

    return res
        .status(200)
        .json(
            new apiResponse(200, video, "Video published successfully")
        );
});

// get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid video id")
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
                isPublished: true
            }
        },
        // get all likes array
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
                    },
                    {
                        $group: {
                            _id: "$liked",
                            likeOwners: {
                                $push: "$likedby"
                            },
                        }
                    }
                ]
            }
        },
        // get all dislikes
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
                        },
                    },
                    {
                        $group: {
                            _id: "$liked",
                            dislikeOwner: {
                                $push: "$likedby"
                            }
                        }
                    }
                ]
            },
        },

        // size of likes and dislikes
        {
            $addFields:
            {
                likes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$likes" }, 0]
                        },
                        then: { $first: "$likes.likeOwners" },
                        else: []
                    }
                },
                dislikes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$dislikes" }, 0]
                        },
                        then: { $first: "$dislikes.dislikeOwner" },
                        else: []
                    }
                }
            }
        },

        // fetch owner details
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
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$owner",
        },
        {
            $project: {
                videoFile: 1,
                title: 1,
                description: 1,
                duration: 1,
                thumbnail: 1,
                views: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1,
                totalLikes: {
                    $size: "$likes",
                },
                totalDisLikes: {
                    $size: "$dislikes",
                },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes"]
                        },
                        then: true,
                        else: false
                    }
                },
                isDisliked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$dislikes"]
                        },
                        then: true,
                        else: false
                    }
                },
                isPublished: 1
            }
        }
    ])

    if (!video.length > 0) {
        new apiError(200, "video is not found")
    }

    return res
        .status(200)
        .json(
            new apiResponse(200, video[0], "Video found successfully")
        )
})

// update video
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title , description } = req.body

    // Check validation
    if(!isValidObjectId(videoId)){
        new apiError(200, "Invalid Video Id")
    }
    
    if(!(title && description)){
        new apiError(400, "Title and Descripition fields are required")
    }
    
    // console.log("req.files",req.file);
    const thumbnailLocalFilePath = req.file?.path
    // console.log("thumbnailLocalFilePath: ", thumbnailLocalFilePath);
    if(!thumbnailLocalFilePath){
        new apiError(400, "Thumbnail file not found")
    }

    // check owner of the video
    const video = await Video.findById(videoId)
    console.log("video: ",video);
    
    if(!video){
        new apiError(400, "Video not found")
    }

    // Only owner can update the video
    if(video.owner.toString() !== req.user._id.toString()){
        new apiError(403, "You are not authorized to update this video")
    }

    // old thumbnail cloudinary path
    const oldThumbnailPublicId = await getPublicIdFromUrl(video.thumbnail)
    console.log("oldThumbnailPublicId: ", oldThumbnailPublicId);

    // upload on cloudinary
    const thumbnailFile = await uploadOnCloudinary(thumbnailLocalFilePath)

    if(!thumbnailFile){
        new apiError(500, "Error while uploading thumbnail file")
    }
    
    // update video
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: thumbnailFile.url,
            }
        },
        { new: true }
    )

    if(!updatedVideo){
        new apiError(500, "Error while updating video")
    }
    
    // delete old thumbnail from cloudinary
    const deleteOldThumbnail = await deleteOldImagesFromCloudinary(oldThumbnailPublicId)
    if(!deleteOldThumbnail){
        new apiError(500, "Error while deleting old thumbnail")
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, updatedVideo, "Video found successfully")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo
}