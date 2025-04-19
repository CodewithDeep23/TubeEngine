import { Router } from 'express';
import {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
} from "../controllers/subscription.controllers.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { checkUser } from '../middlewares/public.middleware.js';

const router = Router();

router
    .route("/c/:channelId")
    .post(verifyJWT, toggleSubscription);
router.route("/c/:subscriberId").get(checkUser, getSubscribedChannels);
router.route("/u/:channelId").get(checkUser, getUserChannelSubscribers);

export default router