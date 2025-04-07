// Delete old images from Cloudinary
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const getPublicIdFromUrl = (url) => {
    const parts = url.split('/');
    const versionIndex = parts.findIndex(part => part.startsWith('v'));
    const publicIdParts = parts.slice(versionIndex + 1);
    const lastSegment = publicIdParts.join('/');
    return lastSegment.replace(/\.[^/.]+$/, ''); // removes .jpg, .png etc.
  };
  

const deleteOldImagesFromCloudinary = async (public_id) => {
    try {
        if (!public_id) return null

        const response = await cloudinary.uploader.destroy(public_id, {
            resource_type: "image"
        })

        return response
    } catch (error) {
        console.log("Error:", error);
        return null
    }
    
}

export { deleteOldImagesFromCloudinary, getPublicIdFromUrl }