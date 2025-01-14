import mongoose from "mongoose";
import { DB_NAME } from "../constants.js"

const connectDB =  async () => {
    try {
        const connectionInst = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB contected !! DB Host:: ${connectionInst.connection.host}`);
    } catch (error) {
        console.log("MongodB connection Error: ", error);
        process.exit(1)
    }
}
export default connectDB