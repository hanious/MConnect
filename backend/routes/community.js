const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../database/community.db");
const db = new sqlite3.Database(dbPath);

// Get community info
router.get("/community-info", (req, res) => {
  db.get(
    `SELECT CommunityName, Description, AdminUserID FROM Community LIMIT 1`,
    [],
    (err, row) => {
      if (err) {
        console.error("Database error in /community-info:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (!row) {
        console.warn("No community info found in database.");
        return res.status(404).json({ error: "Community info not found" });
      }

      res.json({
        CommunityName: row.CommunityName,
        Description: row.Description,
        AdminUserID: row.AdminUserID,
      });
    }
  );
});

// Update community info
router.put("/community-info", (req, res) => {
  const { name, description, userId } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Verify the user is the admin
  db.get(`SELECT AdminUserID FROM Community LIMIT 1`, [], (err, row) => {
    if (err) {
      console.error("Database error in /community-info PUT:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (!row) {
      return res.status(404).json({ error: "Community not found" });
    }

    if (row.AdminUserID !== userId) {
      return res
        .status(403)
        .json({ error: "Only admin can update community info" });
    }

    // Update community info
    db.run(
      `UPDATE Community SET CommunityName = ?, Description = ?`,
      [name, description],
      function (err) {
        if (err) {
          console.error("Database error updating community:", err);
          return res.status(500).json({ error: "Failed to update community" });
        }

        res.json({
          success: true,
          message: "Community info updated successfully",
        });
      }
    );
  });
});

// Get members count
router.get("/members-count", (req, res) => {
  db.get(
    "SELECT COUNT(*) as count FROM User WHERE CommunityID IS NOT NULL",
    [],
    (err, row) => {
      if (err) {
        console.error("Database error in /members-count:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ count: row.count });
    }
  );
});

// Get joined members list
router.get("/joined-members", (req, res) => {
  const query = `
    SELECT 
      UserID,
      FirstName,
      LastName,
      JobTitle,
      Company,
      Industry,
      DateJoined
    FROM User 
    WHERE CommunityID IS NOT NULL
    ORDER BY DateJoined DESC, LastName ASC, FirstName ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Database error in /joined-members:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const members = rows.map((member) => ({
      UserID: member.UserID,
      FirstName: member.FirstName,
      LastName: member.LastName,
      JobTitle: member.JobTitle,
      Company: member.Company,
      Industry: member.Industry,
      DateJoined: member.DateJoined,
    }));

    res.json(members);
  });
});

// Handle join requests
router.post("/join", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId in request body" });
  }

  const communityId = 1; // Assuming single community with ID 1
  const adminId = 1; // Assuming admin has UserID = 1

  // Get user info
  db.get(
    "SELECT FirstName, LastName FROM User WHERE UserID = ?",
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const fullName = `${user.FirstName || "Anonymous"} ${
        user.LastName || "User"
      }`;
      const notificationMessage = `${fullName} requested to join the community`;

      // Check for existing notification
      db.get(
        `SELECT NotificationID FROM Notification 
         WHERE ReceiverID = ? AND SenderID = ? AND CommunityID = ? 
         AND Message = ?`,
        [adminId, userId, communityId, notificationMessage],
        (err, existingNotification) => {
          if (err) {
            return res.status(500).json({ error: "Database error" });
          }
          if (existingNotification) {
            return res.status(400).json({
              error: "You already have a pending join request",
            });
          }

          // Create notification
          db.run(
            `INSERT INTO Notification (
          ReceiverID, SenderID, CommunityID, 
          Message, DateNotified, IsRead
        ) VALUES (?, ?, ?, ?, datetime('now'), ?)`,
            [adminId, userId, communityId, notificationMessage, 0],
            function (err) {
              if (err)
                return res
                  .status(500)
                  .json({ error: "Failed to create notification" });

              res.json({
                success: true,
                message: "Join request sent. Waiting for admin approval.",
              });
            }
          );
        }
      );
    }
  );
});

// Approve join request (admin only)
router.post("/approve-join", (req, res) => {
  const { userId, adminId } = req.body;

  if (!userId || !adminId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Verify admin
  db.get(`SELECT AdminUserID FROM Community LIMIT 1`, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (!row || row.AdminUserID !== adminId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Update user's community ID
    db.run(
      `UPDATE User SET CommunityID = 1 WHERE UserID = ?`,
      [userId],
      function (err) {
        if (err) {
          return res
            .status(500)
            .json({ error: "Failed to approve join request" });
        }

        // Delete the notification
        db.run(
          `DELETE FROM Notification 
             WHERE SenderID = ? AND CommunityID = 1 
             AND Message LIKE '%requested to join the community%'`,
          [userId],
          function (err) {
            if (err) {
              console.error("Failed to delete notification:", err);
            }

            res.json({
              success: true,
              message: "User added to community successfully",
            });
          }
        );
      }
    );
  });
});

module.exports = router;
