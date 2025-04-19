import mongoose, {isValidObjectId} from "mongoose";
import { Subscription } from "../models/subscriptions.models.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";


// Toggle subscription
const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if(!isValidObjectId(channelId)) {
        throw new apiError(400, "Invalid channel ID")
    }

    let isSubscribed;
    const subscription = await Subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId
    })

    if(subscription) {
        const res = await Subscription.deleteOne({
            subscriber: req.user?._id,
            channel: channelId
        })
        isSubscribed = false
    }
    else {
        const newSubscription = await Subscription.create({
            subscriber: req.user?._id,
            channel: channelId
        })
        if(!newSubscription) {
            throw new apiError(500, "Unable to subscribe to channel")
        }
        isSubscribed = true
    }

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            {isSubscribed},
            `Successfully ${isSubscribed ? "subscribed" : "unsubscribed"} to channel`,
        )
    )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    console.log("channelId param:", req.params.channelId);

    if(!isValidObjectId(channelId)) {
        throw new apiError(400, "Invalid channel ID")
    }

    const subscribersList = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId),
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "channel",
                foreignField: "subscriber",
                as: "subscribedChannel",
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribersSubscribers",
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1,
                            subscribersCount: {
                                $size: "$subscribersSubscribers",
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$subscriber",
                preserveNullAndEmptyArrays: true,
            }
        },
        {
            $addFields: {
                "subscriber.isSubscribed": {
                    $cond: {
                        if: { $in: ["$subscriber._id", "$subscribedChannel.channel"] },
                        then: true,
                        else: false,
                    }
                }
            }
        },
        {
            $group: {
                _id: "channel",
                subscriber: { $push: "$subscriber" },
            }
        }
    ])

    const subscribersCount = subscribersList?.length > 0 ? subscribersList[0].subscriber : []

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            subscribersCount,
            "Successfully fetched subscribers list",
        )
    )

})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    console.log("subscriberId param:", req.params.subscriberId);

    if(!isValidObjectId(subscriberId)) {
        throw new apiError(400, "Invalid subscriber ID")
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId),
            }
        },
        // get channel details
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
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
            $unwind: "$channel"
        },
        // get channel's subscribers
        {
            $lookup: {
                from: "subscriptions",
                localField: "channel._id",
                foreignField: "channel",
                as: "channelSubscribers",
            }
        },
        // logic to check if the user is subscribed to the channel
        {
            $addFields: {
                "channel.isSubscribed": {
                    $cond: {
                        if: { $in: [req.user?._id, "$channelSubscribers.subscriber"] },
                        then: true,
                        else: false,
                    }
                },
                "channel.subscribersCount": {
                    $size: "$channelSubscribers",
                }
            }
        },
        {
            $group: {
                _id: "subscriber",
                subscribedChannels: { $push: "$channel" },
            }
        }
    ])

    const users = subscribedChannels?.length > 0 ? subscribedChannels[0].subscribedChannels : []

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            users,
            "Successfully fetched subscribed channels",
        )
    )

})

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels }