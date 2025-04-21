import { Router } from 'express';
import {
    toggleLike,
    getLikedVideos,
    toggleCommentLike,
    toggleVideoLike,
    toggleTweetLike
} from "../controllers/like.controllers.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").patch(toggleLike); // This route is for toggling like on a video, comment, or tweet
router.route("/video/:videoId").patch(toggleVideoLike);
router.route("/comment/:commentId").patch(toggleCommentLike);
router.route("/tweet/:tweetId").patch(toggleTweetLike);
router.route("/videos").get(getLikedVideos);

export default router