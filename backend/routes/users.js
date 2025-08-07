const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const dbPath = path.join(__dirname, "../database/community.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  }
});

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads/avatars");
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Create unique filename: userId_timestamp.extension
    const userId = req.params.userId;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `user_${userId}_${timestamp}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});


// Get user profile by ID (no authentication required)
router.get("/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const sql = `
      SELECT UserID, FirstName, LastName, Email, JobTitle, Company, Industry, AvatarPath, DateJoined, CommunityID
      FROM User
      WHERE UserID = ?
    `;
    db.get(sql, [userId], (err, user) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user profile (no authentication required, userId from params)
router.put("/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const { firstName, lastName, jobTitle, company, industry } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !jobTitle) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // No session check, allow update by userId only
    const sql = `
      UPDATE User 
      SET 
        FirstName = ?,
        LastName = ?,
        JobTitle = ?,
        Company = ?,
        Industry = ?
      WHERE UserID = ?
    `;

    db.run(
      sql,
      [
        firstName,
        lastName,
        jobTitle,
        company || null,
        industry || null,
        userId,
      ],
      function (err) {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: "Failed to update profile" });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        // Return updated user data
        db.get(
          "SELECT UserID, FirstName, LastName, Email, JobTitle, Company, Industry, AvatarPath, DateJoined, CommunityID FROM User WHERE UserID = ?",
          [userId],
          (err, user) => {
            if (err) {
              console.error("Error fetching updated user:", err);
              return res
                .status(500)
                .json({ error: "Failed to fetch updated profile" });
            }
            res.json(user);
          }
        );
      }
    );
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload user avatar
router.post("/:userId/avatar", upload.single('avatar'), async (req, res) => {
  console.log("Avatar upload attempt for user:", req.params.userId);
  console.log("File received:", req.file);
  console.log("Body received:", req.body);
  
  try {
    const userId = req.params.userId;
    
    if (!req.file) {
      console.log("No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File details:", {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });

    // Get the relative path for storing in database
    const relativePath = `/uploads/avatars/${req.file.filename}`;
    
    // Update user's avatar path in database
    const sql = `UPDATE User SET AvatarPath = ? WHERE UserID = ?`;
    
    db.run(sql, [relativePath, userId], function(err) {
      if (err) {
        console.error("Database error:", err);
        // Delete the uploaded file if database update fails
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
        return res.status(500).json({ error: "Failed to update avatar in database" });
      }

      console.log("Database updated, changes:", this.changes);

      if (this.changes === 0) {
        console.log("User not found for ID:", userId);
        // Delete the uploaded file if user not found
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
        return res.status(404).json({ error: "User not found" });
      }

      console.log("Avatar upload successful for user:", userId);
      // Return success response with avatar path
      res.json({ 
        message: "Avatar uploaded successfully",
        avatarPath: relativePath,
        fileName: req.file.filename
      });
    });

  } catch (error) {
    console.error("Error uploading avatar:", error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting file:", unlinkErr);
      });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user avatar
router.get("/:userId/avatar", (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get user's avatar path from database
    db.get("SELECT AvatarPath FROM User WHERE UserID = ?", [userId], (err, user) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      
      if (!user || !user.AvatarPath) {
        return res.status(404).json({ error: "Avatar not found" });
      }
      
      // Construct full file path
      const avatarPath = path.join(__dirname, "..", user.AvatarPath);
      
      // Check if file exists
      if (!fs.existsSync(avatarPath)) {
        return res.status(404).json({ error: "Avatar file not found" });
      }
      
      // Send the file
      res.sendFile(avatarPath);
    });
    
  } catch (error) {
    console.error("Error serving avatar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
