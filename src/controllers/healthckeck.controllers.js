import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";

const healthchecker = asyncHandler( async (req, res) => {
    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            { status: "Ok"},
            "Service is running smoothly"
        )
    )
})

export { healthchecker }