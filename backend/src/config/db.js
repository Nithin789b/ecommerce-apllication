import mongoose from "mongoose";
import dns from "node:dns";
import dotenv from "dotenv";
dotenv.config();

// Optional workaround for local networks whose configured resolver refuses Atlas SRV queries.
// Leave unset in production so the host's configured DNS resolvers are used.
const dnsServers = process.env.MONGODB_DNS_SERVERS
    ?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);
if (dnsServers?.length) dns.setServers(dnsServers);

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(`Error: ${error.message}`);
        throw error;
    }
};

export default connectDB;
