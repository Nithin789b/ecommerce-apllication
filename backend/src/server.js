import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import { authenticateSocket } from "./socket/socket-auth.middleware.js";
import { registerProductSocketHandlers } from "./socket/product-socket.handlers.js";

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://mongo:27017/ecommerce_test?replicaSet=rs0";
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: CLIENT_URL, credentials: true }
});

app.set("io", io);
io.use(authenticateSocket);
registerProductSocketHandlers(io);

const startServer = async () => {
    await connectDB();
    httpServer.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};

startServer().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
});
