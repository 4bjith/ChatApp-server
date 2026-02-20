import pool from "../db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { transporter } from "../mailer.js";
dotenv.config();
//
export const requestOTP = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // Check if user already exists
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length > 0) {
      // Update existing user with new OTP and name
      await pool.query(
        "UPDATE users SET otp = ?, otp_expire_at = ?, name = ? WHERE email = ?",
        [otp, otpExpiry, name || users[0].name, email],
      );
    } else {
      // Create new user with OTP
      await pool.query(
        "INSERT INTO users (email, name, otp, otp_expire_at) VALUES (?, ?, ?, ?)",
        [email, name, otp, otpExpiry],
      );
    }
    //  TODO: send OTP via Email gateway. For now, just log it.
    console.log(`OTP for ${email}: ${otp}`);

    transporter.sendMail(
      {
        from: `"Your App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your OTP Code",
        html: `
            <div style="font-family: Arial, sans-serif;">
                    <h2>OTP Verification</h2>
                    <p>Your OTP is:</p>
                    <h1 style="letter-spacing: 3px;">${otp}</h1>
                    <p>This OTP will expire in <b>5 minutes</b>.</p>
                </div>`,
      },
      (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      },
    );
    res.status(200).json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    console.error("Error in requestOTP:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Verify OTP and generate JWT - Login/signup
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const [users] = await pool.query("SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expire_at >= NOW()", [email, otp]);

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = users[0];

    // Mark OTP as verified
    await pool.query(
      `UPDATE users 
       SET otp = NULL,
           otp_expire_at = NULL,
           is_verified = 'yes',
           is_online = 'online'
       WHERE user_id = ?`,
      [user.user_id]
    );
    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        is_verified: user.is_verified,
        is_online: user.is_online,
      },
    });
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// Get current loged in user details
export const getMe = async (req, res) => {
  try {
    const user_id = req.user?.user_id; // From auth middleware

    const [users] = await pool.query(
      `SELECT user_id, name, username, email, profile_image, is_online, last_seen, created_at 
       FROM users WHERE user_id = ?`,
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("Error in getMe:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export const logout = async (req, res) => {
  try {
    const user_id = req.user?.user_id; // From auth middleware

    await pool.query(
      `UPDATE users 
       SET is_online = 'offline',
            last_seen = NOW()
       WHERE user_id = ?`,
      [user_id]
    );
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT user_id, name, username, email, profile_image, is_online, last_seen, created_at 
       FROM users`
    );

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export const searchUserByUsername = async (req, res) => {
  try {
    const { username } = req.query;
    const current_user_id = req.user?.user_id;

    if (!username) return res.status(400).json({ success: false, message: "Username is required" });

    const [users] = await pool.query(
      "SELECT user_id, name, username, email, profile_image, is_online FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const foundUser = users[0];

    // Check relationship status
    const [request] = await pool.query(
      "SELECT * FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
      [current_user_id, foundUser.user_id, foundUser.user_id, current_user_id]
    );

    let relationship = "none";
    if (request.length > 0) {
      if (request[0].status === "accepted") {
        relationship = "friends";
      } else if (request[0].sender_id === current_user_id) {
        relationship = "pending_sent";
      } else {
        relationship = "pending_received";
      }
    }

    res.status(200).json({ success: true, user: { ...foundUser, relationship } });
  } catch (error) {
    console.error("Error in searchUserByUsername:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.query(
      `SELECT 
        user_id,
        name,
        username,
        email,
        profile_image,
        is_online,
        last_seen,
        created_at
       FROM users
       WHERE user_id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user: users[0]
    });

  } catch (error) {
    console.error("Error in getUserById:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user_id = req.user?.user_id; // from auth middleware
    let { name } = req.body;

    let profile_image = req.body.profile_image;

    // if a file was uploaded, use the generated path
    if (req.file) {
      profile_image = `uploads/${req.file.filename}`;
    }

    // Build the update query dynamically based on what's provided
    let fields = [];
    let values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (req.body.username !== undefined) {
      const username = req.body.username.toLowerCase().trim();
      // Basic validation: small letters, numbers, _, @, .
      const usernameRegex = /^[a-z0-9_@.]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ success: false, message: "Invalid username format. Use lowercase letters, numbers, _, @, or ." });
      }

      // Check if username taken
      const [existing] = await pool.query("SELECT user_id FROM users WHERE username = ? AND user_id != ?", [username, user_id]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }

      fields.push('username = ?');
      values.push(username);
    }
    if (profile_image !== undefined) {
      fields.push('profile_image = ?');
      values.push(profile_image);
    }
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    values.push(user_id); // Add user_id to the end of values array for WHERE clause

    const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;

    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const [updatedUsers] = await pool.query(
      `SELECT user_id, name, username, email, profile_image, is_online, last_seen, created_at 
       FROM users WHERE user_id = ?`,
      [user_id]
    );
    res.status(200).json({ success: true, message: "User updated successfully", user: updatedUsers[0] });
  } catch (err) {
    console.error("Error in updateUser:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// Delete user account
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      "DELETE FROM users WHERE user_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ message: "Server error" });
  }
};