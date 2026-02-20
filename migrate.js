import pool from "./db.js";

async function migrate() {
    try {
        console.log("Starting migration...");

        // Add username column to users table
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN username VARCHAR(50) UNIQUE AFTER name
        `).catch(err => {
            if (err.code === 'ER_DUP_COLUMN_NAME') {
                console.log("Column 'username' already exists.");
            } else {
                throw err;
            }
        });

        // Create friend_requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friend_requests (
                request_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                sender_id BIGINT UNSIGNED NOT NULL,
                receiver_id BIGINT UNSIGNED NOT NULL,
                status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_request (sender_id, receiver_id),
                FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);

        // Create friendships table (or we can just use conversations)
        // Let's create a separate table for cleaner management
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friendships (
                friendship_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user1_id BIGINT UNSIGNED NOT NULL,
                user2_id BIGINT UNSIGNED NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_friendship (user1_id, user2_id),
                FOREIGN KEY (user1_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (user2_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
