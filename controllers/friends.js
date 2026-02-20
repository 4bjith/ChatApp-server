import pool from "../db.js";
import { getIO, getUserSocket } from "../socket.js";

export const sendFriendRequest = async (req, res) => {
    try {
        const sender_id = req.user?.user_id;
        const { receiver_username } = req.body;

        if (!receiver_username) {
            return res.status(400).json({ success: false, message: "Username is required" });
        }

        // Find receiver
        const [users] = await pool.query("SELECT user_id, name, username, profile_image FROM users WHERE username = ?", [receiver_username]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const receiver_id = users[0].user_id;

        if (Number(sender_id) === Number(receiver_id)) {
            return res.status(400).json({ success: false, message: "You cannot send a request to yourself" });
        }

        // Check if request already exists
        const [existing] = await pool.query(
            "SELECT * FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
            [sender_id, receiver_id, receiver_id, sender_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Friend request already pending or you are already friends" });
        }

        const [result] = await pool.query(
            "INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)",
            [sender_id, receiver_id]
        );

        // Notify receiver via Socket.io
        try {
            const io = getIO();
            const receiverSocketId = getUserSocket(receiver_id);
            if (receiverSocketId) {
                // Fetch sender info for notification
                const [senderInfo] = await pool.query("SELECT user_id, name, username, profile_image FROM users WHERE user_id = ?", [sender_id]);
                io.to(receiverSocketId).emit("incoming_friend_request", {
                    request_id: result.insertId,
                    sender: senderInfo[0]
                });
            }
        } catch (socketErr) {
            console.error("Socket notification failed:", socketErr);
        }

        res.status(200).json({ success: true, message: "Friend request sent" });
    } catch (error) {
        console.error("Error in sendFriendRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getFriendRequests = async (req, res) => {
    try {
        const user_id = req.user?.user_id;

        const [requests] = await pool.query(
            `SELECT fr.*, u.name, u.username, u.profile_image 
             FROM friend_requests fr 
             JOIN users u ON fr.sender_id = u.user_id 
             WHERE fr.receiver_id = ? AND fr.status = 'pending'`,
            [user_id]
        );

        res.status(200).json({ success: true, requests });
    } catch (error) {
        console.error("Error in getFriendRequests:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const acceptFriendRequest = async (req, res) => {
    try {
        const user_id = req.user?.user_id;
        const { request_id } = req.body;

        const [requests] = await pool.query("SELECT * FROM friend_requests WHERE request_id = ? AND receiver_id = ?", [request_id, user_id]);
        if (requests.length === 0) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        const request = requests[0];

        // Start transaction
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // Update request status
            await conn.query("UPDATE friend_requests SET status = 'accepted' WHERE request_id = ?", [request_id]);

            // Add to friendships
            await conn.query("INSERT INTO friendships (user1_id, user2_id) VALUES (?, ?)",
                [Math.min(request.sender_id, request.receiver_id), Math.max(request.sender_id, request.receiver_id)]);

            // Create conversation if not exists
            const [convs] = await conn.query(
                "SELECT * FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
                [request.sender_id, request.receiver_id, request.receiver_id, request.sender_id]
            );

            if (convs.length === 0) {
                await conn.query("INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)",
                    [Math.min(request.sender_id, request.receiver_id), Math.max(request.sender_id, request.receiver_id)]);
            }

            await conn.commit();
            res.status(200).json({ success: true, message: "Friend request accepted" });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error("Error in acceptFriendRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getFriendsList = async (req, res) => {
    try {
        const user_id = req.user?.user_id;

        const [friends] = await pool.query(
            `SELECT u.user_id, u.name, u.username, u.profile_image, u.is_online 
             FROM friendships f 
             JOIN users u ON (f.user1_id = u.user_id OR f.user2_id = u.user_id)
             WHERE (f.user1_id = ? OR f.user2_id = ?) AND u.user_id != ?`,
            [user_id, user_id, user_id]
        );

        res.status(200).json({ success: true, friends });
    } catch (error) {
        console.error("Error in getFriendsList:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
