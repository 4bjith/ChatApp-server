import pool from "../db.js";


export const createMessage = async (req, res) => {
  try {
    const user_id = req.user?.user_id; // From auth middleware
    const { receiver_id, message } = req.body;

    if (!user_id) {
      return res.status(401).json({ success: false, message: "Unauthorized", req_user_id: req.user?.user_id });
    }

    if (!receiver_id || !message) {
      return res.status(400).json({ success: false, message: "Receiver ID and message are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`,
      [user_id, receiver_id, message]
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      message_id: result.insertId,
    });
  } catch (error) {
    console.error("Error in createMessage:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export const getMessages = async (req, res) => {
  try {
   const sender_id = req.user?.user_id; // From auth middleware
    const { receiver_id } = req.body;
    
    if (!receiver_id) {
      return res.status(400).json({ success: false, message: "Receiver ID is required" });
    }

    const [messages] = await pool.query(
      `SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?)`,
      [sender_id, receiver_id, receiver_id, sender_id]
    );

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Error in getMessages:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export const deleteMessage = async (req, res) => {
  try {
    const { sender_id } = req?.user.user_id;
    const { message_id } = req.params;
    const [result] = await pool.query(
      `DELETE FROM messages WHERE message_id = ? AND sender_id = ?`,
      [message_id, sender_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Message not found or you don't have permission to delete it" });
    }
    res.status(200).json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } 
}

export const isSeen = async (req, res) => {
  try {
    const { receiver_id, message_id } = req.body;
    const user_id = req.user?.user_id; // From auth middleware

    if (!receiver_id) {
      return res.status(400).json({ success: false, message: "Receiver ID is required" });
    }

    await pool.query(
      `UPDATE messages SET is_read = 1 WHERE message_id = ? AND sender_id = ? AND receiver_id = ?`,
      [message_id, user_id, receiver_id]
    );

    res.status(200).json({ success: true, message: "Message marked as seen" });
  } catch (error) {
    console.error("Error in isSeen:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}