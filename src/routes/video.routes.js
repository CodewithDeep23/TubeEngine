import { Router } from 'express';
import { getAllVideos, publishAVideo, getVideoById, updateVideo, deleteVideo, togglePublishStatus, updateView, getAllVideosByOption} from '../controllers/video.controllers.js';
import {verifyJWT} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.middleware.js"
import { checkUser } from '../middlewares/public.middleware.js';

const router = Router();
// router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
    .route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
            
        ]),
        publishAVideo
    );

router
    .route("/:videoId")
    .get(verifyJWT, getVideoById)
    .delete(verifyJWT, deleteVideo)
    .patch(upload.single("thumbnail"),verifyJWT, updateVideo);

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);
router.route("/view/:videoId").patch(checkUser, updateView)
router.route("/all/option").get(getAllVideosByOption);

export default router