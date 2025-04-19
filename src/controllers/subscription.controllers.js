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

export { toggleSubscription }