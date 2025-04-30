import { Router } from 'express';
import {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
    getAllUserFeedTweets,
    getAllTweets
} from "../controllers/tweets.controllers.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import {checkUser} from "../middlewares/public.middleware.js"

const router = Router();
router.route("/feed").get(checkUser, getAllUserFeedTweets);
router.route("/").post(verifyJWT, createTweet).get(verifyJWT, getAllTweets);
router.route("/user/:userId").get(checkUser, getUserTweets);
router
    .route("/:tweetId")
    .patch(verifyJWT, updateTweet)
    .delete(verifyJWT, deleteTweet);

export default router