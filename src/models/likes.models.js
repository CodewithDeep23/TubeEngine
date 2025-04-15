import mongoose from "mongoose";

const likeSchema = new mongoose.Schema({
    comment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
    },
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video",
    },
    likedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    tweet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tweet",
    },
    liked: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true })

export const Like = mongoose.model("Like", likeSchema)