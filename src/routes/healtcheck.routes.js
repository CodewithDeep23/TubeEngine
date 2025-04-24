import { Router } from "express";
import { healthchecker } from "../controllers/healthckeck.controllers.js";
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router()

router.route("/").get(verifyJWT, healthchecker)

export default router