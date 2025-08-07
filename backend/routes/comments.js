// backend/routes/comments.js
const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database connection
const dbPath = path.join(__dirname, "../database/community.db");
const db = new sqlite3.Database(dbPath);

// =====================
// COMMENTS ENDPOINTS
// =====================

// Get all comments for a specific post
router.get("/post/:postId", async (req, res) => {
  const { postId } = req.params;

  try {
    const comments = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          c.CommentID,
          c.PostID,
          c.UserID,
          c.CommentText,
          c.DateCommented,
          u.FirstName,
          u.LastName,
          u.JobTitle
        FROM Comment c
        LEFT JOIN User u ON c.UserID = u.UserID
        WHERE c.PostID = ?
        ORDER BY c.DateCommented ASC
        `,
        [postId],
        (err, rows) => {
          if (err) {
            console.error("Database error:", err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });

    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Create a new comment
router.post("/", async (req, res) => {
  const { postId, commentText, currentUserId } = req.body;

  // Validation
  if (!postId || !commentText) {
    return res.status(400).json({
      error: "PostID and CommentText are required",
    });
  }

  if (!commentText.trim()) {
    return res.status(400).json({
      error: "Comment text cannot be empty",
    });
  }

  try {
    // Use the provided currentUserId or default to 1
    const userId = currentUserId || 1;

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO Comment (PostID, UserID, CommentText)
         VALUES (?, ?, ?)`,
        [postId, userId, commentText.trim()],
        function (err) {
          if (err) {
            console.error("Database insert error:", err);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });

    // Get the created comment with user details
    const newComment = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          c.CommentID,
          c.PostID,
          c.UserID,
          c.CommentText,
          c.DateCommented,
          u.FirstName,
          u.LastName,
          u.JobTitle
        FROM Comment c
        LEFT JOIN User u ON c.UserID = u.UserID
        WHERE c.CommentID = ?
        `,
        [result],
        (err, row) => {
          if (err) {
            console.error("Database select error:", err);
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    res.status(201).json(newComment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// Update a comment
router.put("/:commentId", async (req, res) => {
  const { commentId } = req.params;
  const { commentText } = req.body;

  // Validation
  if (!commentText || !commentText.trim()) {
    return res.status(400).json({
      error: "Comment text is required and cannot be empty",
    });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE Comment 
         SET CommentText = ?
         WHERE CommentID = ?`,
        [commentText.trim(), commentId],
        function (err) {
          if (err) {
            console.error("Database update error:", err);
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });

    if (result === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Get the updated comment with user details
    const updatedComment = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          c.CommentID,
          c.PostID,
          c.UserID,
          c.CommentText,
          c.DateCommented,
          u.FirstName,
          u.LastName,
          u.JobTitle
        FROM Comment c
        LEFT JOIN User u ON c.UserID = u.UserID
        WHERE c.CommentID = ?
        `,
        [commentId],
        (err, row) => {
          if (err) {
            console.error("Database select error:", err);
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    res.json({
      message: "Comment updated successfully",
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Failed to update comment" });
  }
});

// Delete a comment
router.delete("/:commentId", async (req, res) => {
  const { commentId } = req.params;

  // Validation
  if (!commentId || isNaN(commentId)) {
    return res.status(400).json({ error: "Valid CommentID is required" });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM Comment WHERE CommentID = ?",
        [commentId],
        function (err) {
          if (err) {
            console.error("Database delete error:", err);
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });

    if (result === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    res.json({
      message: "Comment deleted successfully",
      deletedCount: result,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

module.exports = router;
