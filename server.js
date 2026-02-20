import express from "express";
import cors from "cors";
import fs from 'fs';
import http from 'http';
import dotenv from 'dotenv';

import userRouter from "./routes/users.routes.js";
import chatRouter from "./routes/messages.routes.js";
import friendRouter from "./routes/friends.routes.js";

dotenv.config();

const app = express();  // createing an express app
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;


// ---------cors setups------
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use('/uploads', express.static('uploads'));

app.use("/users", userRouter);
app.use("/chat", chatRouter);
app.use("/friends", friendRouter);

//----------Default route-----
app.use("/", (req, res) => {
    res.json({
        message: 'Chat App Backend API id running 🚩'
    });
});
// app.use("/users", userRouter);

//--------Start server---------
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);

});
