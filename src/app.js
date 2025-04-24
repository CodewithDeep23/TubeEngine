import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


// routes import
import userRouter from './routes/user.routes.js'
import videoRouter from './routes/video.routes.js'
import subscriptionRouter from './routes/subscription.routes.js'
import likeRouter from './routes/like.routes.js'
import commentRouter from './routes/comment.routes.js'
import playlistRouter from './routes/playlist.routes.js'
import tweetRouter from './routes/tweets.routes.js'
import dashboardRouter from './routes/dashboard.routes.js'
import healthcheckRouter from './routes/healtcheck.routes.js'

// routes declaration
app.use("/api/v2/users", userRouter)
app.use("/api/v2/videos", videoRouter)
app.use("/api/v2/subscriptions", subscriptionRouter)
app.use("/api/v2/likes", likeRouter)
app.use("/api/v2/comments", commentRouter)
app.use("/api/v2/playlists", playlistRouter)
app.use("/api/v2/tweets", tweetRouter)
app.use("/api/v2/dashboard", dashboardRouter)
app.use("/api/v2/healthcheck", healthcheckRouter)

// http://localhost:8000/api/v2/user/register

export {app}