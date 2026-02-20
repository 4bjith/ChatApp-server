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

// get all received message list (Conversation List for Home)
export const getAllReceivedMessagesList = async (req, res) => {
  try {
    const user_id = req.user?.user_id; // From auth middleware
    const [rows] = await pool.query(
      `SELECT 
        m.*, 
        s.name as sender_name, s.profile_image as sender_image, s.is_online as sender_online,
        r.name as receiver_name, r.profile_image as receiver_image, r.is_online as receiver_online,
        (SELECT COUNT(*) FROM messages m2 
         WHERE m2.sender_id = (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) 
         AND m2.receiver_id = ? 
         AND m2.is_read = 0) as unread_count
      FROM messages m
      LEFT JOIN users s ON m.sender_id = s.user_id
      LEFT JOIN users r ON m.receiver_id = r.user_id
      WHERE m.message_id IN (
        SELECT MAX(message_id)
        FROM messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
      )
      ORDER BY m.sent_at DESC`,
      [user_id, user_id, user_id, user_id]
    );

    const messages = rows.map(msg => ({
      message_id: msg.message_id,
      message: msg.message,
      is_read: msg.is_read,
      sent_at: msg.sent_at,
      unread_count: msg.unread_count,
      sender_id: {
        user_id: msg.sender_id,
        name: msg.sender_name,
        profile_image: msg.sender_image,
        is_online: msg.sender_online
      },
      receiver_id: {
        user_id: msg.receiver_id,
        name: msg.receiver_name,
        profile_image: msg.receiver_image,
        is_online: msg.receiver_online
      }
    }));

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Error in getAllReceivedMessagesList:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}


export const getMessages = async (req, res) => {
  try {
    const sender_id = req.user?.user_id; // From auth middleware
    const { receiver_id } = req.query;
    if (!receiver_id) {
      return res.status(400).json({ success: false, message: "Receiver ID is required" });
    }

    const [rows] = await pool.query(
      `SELECT 
        m.*, 
        s.name as sender_name, s.profile_image as sender_image, s.is_online as sender_online,
        r.name as receiver_name, r.profile_image as receiver_image, r.is_online as receiver_online
      FROM messages m
      LEFT JOIN users s ON m.sender_id = s.user_id
      LEFT JOIN users r ON m.receiver_id = r.user_id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.sent_at ASC`,
      [sender_id, receiver_id, receiver_id, sender_id]
    );

    const messages = rows.map(msg => ({
      message_id: msg.message_id,
      message: msg.message,
      is_read: msg.is_read,
      sent_at: msg.sent_at,
      sender_id: {
        user_id: msg.sender_id,
        name: msg.sender_name,
        profile_image: msg.sender_image,
        is_online: msg.sender_online
      },
      receiver_id: {
        user_id: msg.receiver_id,
        name: msg.receiver_name,
        profile_image: msg.receiver_image,
        is_online: msg.receiver_online
      }
    }));

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
    const sender_id = req.user?.user_id;
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