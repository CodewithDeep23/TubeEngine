import mongoose, {isValidObjectId} from "mongoose"
import { Playlist } from "../models/playlist.models.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.models.js"
import { Video } from "../models/video.models.js"


//TODO: create playlist
const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    if(!name) {
        throw new apiError(400, "Name is required")
    }

    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user?._id
    })

    if(!playlist) {
        throw new apiError(500, "Unable to create playlist")
    }

    return res
    .status(201)
    .json(
        new apiResponse(
            201,
            playlist,
            "Playlist created successfully"
        )
    )
})

//TODO: get user playlists
const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if(!isValidObjectId(userId)) {
        throw new apiError(400, "Invalid user id")
    }

    const findUser = await User.findById(userId)
    if(!findUser) {
        throw new apiError(404, "User not found")
    }

    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
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
                            email: 1,
                            views: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $project: {
                            thumbnail: 1,
                            views: 1
                        }
                    }
                ]
            }
        },
        { $unwind: "$owner" },
        {
            $project: {
                name: 1,
                description: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1,
                totalVideos: {
                    $size: "$videos"
                },
                thumbnail: {
                    $first: "$videos.thumbnail"
                },
                totalViews: {
                    $sum: "$videos.views"
                }
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            playlists,
            "Playlists fetched successfully"
        )
    )
})

//TODO: get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if(!isValidObjectId(playlistId)) {
        throw new apiError(400, "Invalid playlist id")
    }

    const findPlaylist = await Playlist.findById(playlistId)
    if(!findPlaylist) {
        throw new apiError(404, "Playlist not found")
    }

    const playlist = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $match: {
                            isPublished: true
                        }
                    },
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
                                        usrname: 1
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
        },
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
        },
        {
            $project: {
                name: 1,
                description: 1,
                owner: 1,
                videos: 1,
                createdAt: 1,
                updatedAt: 1,
                totalVideos: {
                    $size: "$videos"
                },
                thumbnail: {
                    $first: "$videos.thumbnail"
                },
                totalViews: {
                    $sum: "$videos.views"
                }
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            playlist,
            "Playlist fetched successfully"
        )
    )
})

// TODO: add video to playlist
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid id")
    }
    // findout playlist and video
    const findPlaylist = await Playlist.findById(playlistId)
    if(!findPlaylist) {
        throw new apiError(404, "Playlist not found")
    }
    const findVideo = await Video.findById(videoId)
    if(!findVideo) {
        throw new apiError(404, "Video not found")
    }

    // only owner can add video to playlist
    if(findPlaylist.owner?.toString() && findVideo.owner?.toString() !== req.user?._id.toString()){
        throw new apiError(403, "You are not allowed to add video to this playlist")
    }

    // check if video already exists in playlist
    const isVideoInPlaylist = await Playlist.exists({
        _id: playlistId,
        videos: videoId
    })

    console.log("isVideoInPlaylist: ",isVideoInPlaylist);

    if(isVideoInPlaylist) {
        throw new apiError(400, "Video already exists in playlist")
    }

    // add video to playlist
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )

    // check if playlist updated successfully
    if(!updatedPlaylist) {
        throw new apiError(500, "Unable to add video to playlist")
    }

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            updatedPlaylist,
            "Video added to playlist successfully"
        )
    )
})

// TODO: remove video from playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid id")
    }

    // findout playlist and video
    const findPlaylist = await Playlist.findById(playlistId)
    if(!findPlaylist) {
        throw new apiError(404, "Playlist not found")
    }
    const findVideo = await Video.findById(videoId)
    if(!findVideo) {
        throw new apiError(404, "Video not found")
    }

    // only owner can remove video from playlist
    if(findPlaylist.owner?.toString() && findVideo.owner?.toString() !== req.user?._id.toString()){
        throw new apiError(403, "You are not allowed to remove video from this playlist")
    }

    // remove video from playlist
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )

    if(!updatedPlaylist) {
        throw new apiError(500, "Unable to remove video from playlist")
    }

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            updatedPlaylist,
            "Video removed from playlist successfully"
        )
    )
})

// TODO: delete playlist
const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    if(!isValidObjectId(playlistId)) {
        throw new apiError(400, "Invalid playlist id")
    }

    // findout playlist
    const findPlaylist = await Playlist.findById(playlistId)
    if(!findPlaylist) {
        throw new apiError(404, "Playlist not found")
    }
    // console.log("findPlaylist: ",findPlaylist);

    // only owner can delete playlist
    if(findPlaylist.owner?.toString() !== req.user?._id.toString()){
        throw new apiError(403, "You are not allowed to delete this playlist")
    }

    // delete playlist
    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)
    if(!deletedPlaylist) {
        throw new apiError(500, "Unable to delete playlist")
    }

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            {isDeleted: true},
            "Playlist deleted successfully"
        )
    )
})

//TODO: update playlist
const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body

    if(!isValidObjectId(playlistId)) {
        throw new apiError(400, "Invalid playlist id")
    }

    if(!name) {
        throw new apiError(400, "Name is required")
    }

    const findPlaylist = await Playlist.findById(playlistId)
    if(!findPlaylist) {
        throw new apiError(404, "Playlist not found")
    }

    // only owner can update playlist
    if(findPlaylist.owner?.toString() !== req.user?._id.toString()){
        throw new apiError(403, "You are not allowed to update this playlist")
    }

    // update playlist
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name,
                description
            }
        },
        {
            new: true
        }
    )

    if(!updatedPlaylist) {
        throw new apiError(500, "Unable to update playlist")
    }

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            updatedPlaylist,
            "Playlist updated successfully"
        )
    )
})

// TODO: get video Save playlist
const getVideoSavePlaylists = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
  
    if (!isValidObjectId(videoId))
      throw new apiError(400, "Valid videoId required");
  
    const playlists = await Playlist.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(req.user?._id),
        },
      },
      {
        $project: {
          name: 1,
          isVideoPresent: {
            $cond: {
              if: { $in: [new mongoose.Types.ObjectId(videoId), "$videos"] },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);
  
    return res
      .status(200)
      .json(new apiResponse(200, playlists, "Playlists sent successfully"));
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist,
    getVideoSavePlaylists
}