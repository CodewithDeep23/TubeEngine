import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilepath) => {
    try {
        if (!localFilepath) return null

        const response = await cloudinary.uploader.upload(localFilepath,
            {
                resource_type: "auto"
            }
        )

        // console.log("File is uploaded on cloudinary", response.url);
        // console.log(response);
        fs.unlinkSync(localFilepath)
        return response
    } catch (error) {
        console.log("Error:", error);
        if(fs.existsSync(localFilepath)){
            fs.unlinkSync(localFilepath)
        }
        // fs.unlinkSync(localFilepath)
        // remove the locally saved temporary file as the upload operation failed
        return null
    }
}

export {uploadOnCloudinary}

// Image upload

// const uploadResult = await cloudinary.uploader
//     .upload(
//         'https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg', {
//         public_id: 'shoes',
//     }
//     )
//     .catch((error) => {
//         console.log(error);
//     });