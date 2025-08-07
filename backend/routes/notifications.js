// backend/routes/notifications.js
const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database connection
const dbPath = path.join(__dirname, "../database/community.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  }
});

// Get notifications for a user
router.get("/", (req, res) => {
  const receiverId = req.query.userId;
  if (!receiverId) {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  db.all("SELECT * FROM Notification WHERE ReceiverID = ? ORDER BY DateNotified DESC", [receiverId], (err, notifications) => {
    if (err) {
      console.error("Database error in /api/notifications:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(notifications);
  });
});

// Get unread notification count for a user
router.get("/unread-count", (req, res) => {
  const receiverId = req.query.userId;
  if (!receiverId) {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  db.get(
    "SELECT COUNT(*) AS unreadCount FROM Notification WHERE ReceiverID = ? AND IsRead = 0",
    [receiverId],
    (err, row) => {
      if (err) {
        console.error("Database error in /api/notifications/unread-count:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ unreadCount: row.unreadCount });
    }
  );
});

// Mark all notifications as read for a user
router.post("/mark-read", (req, res) => {
  const receiverId = req.body.userId;
  if (!receiverId) {
    return res.status(400).json({ error: "Missing userId in request body" });
  }

  db.run(
    "UPDATE Notification SET IsRead = 1 WHERE ReceiverID = ? AND IsRead = 0",
    [receiverId],
    function (err) {
      if (err) {
        console.error("Database error in /api/notifications/mark-read:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ message: "Notifications marked as read", changes: this.changes });
    }
  );
});

// Process join request (approve/reject)
router.post("/process-join", async (req, res) => {
  const { notificationId, userId, approve } = req.body;

  try {
    // 1. Get community info
    const communityInfo = await new Promise((resolve, reject) => {
      db.get("SELECT CommunityName FROM Community WHERE CommunityID = 1", 
        [], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
    });

    if (!communityInfo) {
      return res.status(404).json({ error: "Community not found" });
    }

    // 2. Process approval/rejection
    if (approve) {
      await new Promise((resolve, reject) => {
        db.run("UPDATE User SET CommunityID = 1 WHERE UserID = ?", 
          [userId], function(err) {
            if (err) reject(err);
            else resolve();
          });
      });
    }

    // 3. Create notification for the sender
    const message = approve 
      ? `Your request to join ${communityInfo.CommunityName} has been approved`
      : `Your request to join ${communityInfo.CommunityName} has been declined`;

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO Notification (
          SenderID, ReceiverID, CommunityID, Message, DateNotified, IsRead
        ) VALUES (?, ?, ?, ?, datetime('now', '+7 hours'), ?)`,
        [
          userId, // System is sender
          userId, // Original sender is now receiver
          1,      // CommunityID
          message,
          0       // IsRead
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // 4. Delete the original notification
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM Notification WHERE NotificationID = ?",
        [notificationId], function(err) {
          if (err) reject(err);
          else resolve();
        });
    });

    res.json({ 
      success: true,
      message: approve ? "User approved to join community" : "Join request rejected"
    });

  } catch (error) {
    console.error("Error processing join request:", error);
    res.status(500).json({ 
      error: "Failed to process join request",
      details: error.message 
    });
  }
});

module.exports = router;