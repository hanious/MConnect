// backend/routes/posts.js
const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database connection
const dbPath = path.join(__dirname, "../database/community.db");
const db = new sqlite3.Database(dbPath);

// =====================
// POSTS ENDPOINTS
// =====================

// Get all posts with like counts and user like status
router.get("/", async (req, res) => {
  try {
    // Get current user ID from session or request
    const currentUserId = req.user ? req.user.UserID : null;

    const posts = await new Promise((resolve, reject) => {
      // Query to get posts with like counts and user like status
      const query = `
        SELECT 
          p.PostID,
          p.UserID,
          p.Content,
          p.ImageURL,
          p.DatePosted,
          u.FirstName,
          u.LastName,
          u.JobTitle,
          CASE WHEN l.LikeID IS NOT NULL THEN 1 ELSE 0 END as IsLikedByUser
        FROM Post p
        LEFT JOIN User u ON p.UserID = u.UserID
        LEFT JOIN Like l ON p.PostID = l.PostID AND l.UserID = ?
        ORDER BY p.DatePosted DESC
      `;

      db.all(query, [currentUserId], (err, rows) => {
        if (err) {
          console.error("Database error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Create new post
router.post("/", async (req, res) => {
  try {
    const { content, image_url, currentUserId } = req.body;

    const userId = currentUserId;

    // Validate required fields
    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Content is required" });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO Post (UserID, Content, ImageURL, DatePosted) 
         VALUES (?, ?, ?, datetime('now', '+7 hours'))`,
        [userId, content.trim(), image_url || null],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    // Get the created post with user info
    const newPost = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          p.PostID,
          p.UserID,
          p.Content,
          p.ImageURL,
          p.DatePosted,
          COALESCE(u.FirstName, '') as FirstName,
          COALESCE(u.LastName, '') as LastName,
          COALESCE(u.JobTitle, '') as JobTitle
        FROM Post p
        LEFT JOIN User u ON p.UserID = u.UserID
        WHERE p.PostID = ?
      `,
        [result.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
  }
});

// Get specific post by ID
router.get("/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const currentUserId = req.user ? req.user.UserID : null;

    const post = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          p.PostID,
          p.UserID,
          p.Content,
          p.ImageURL,
          p.DatePosted,
          u.FirstName,
          u.LastName,
          u.JobTitle,
          CASE WHEN l.LikeID IS NOT NULL THEN 1 ELSE 0 END as IsLikedByUser
        FROM Post p
        LEFT JOIN User u ON p.UserID = u.UserID
        LEFT JOIN Like l ON p.PostID = l.PostID AND l.UserID = ?
        WHERE p.PostID = ?
      `,
        [currentUserId, postId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Delete a post
router.delete("/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    // Start a transaction
    await new Promise((resolve, reject) => {
      db.run("BEGIN TRANSACTION", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // // Delete all comments associated with this post first
    // await new Promise((resolve, reject) => {
    //   db.run("DELETE FROM Comment WHERE PostID = ?", [postId], function (err) {
    //     if (err) reject(err);
    //     else {
    //       console.log("Deleted", this.changes, "comments for post", postId);
    //       resolve();
    //     }
    //   });
    // });

    // Now delete the post
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM `Post` WHERE `PostID` = ?", [postId], function (err) {
        if (err) reject(err);
        else {
          if (this.changes === 0) {
            reject(new Error("Post not found, Post ID:", postId));
          } else {
            resolve();
          }
        }
      });
    });

    // Commit the transaction
    await new Promise((resolve, reject) => {
      db.run("COMMIT", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      message: "Post and associated likes deleted successfully",
      postId: postId,
    });
  } catch (error) {
    // Rollback on error
    db.run("ROLLBACK");
    console.error("Error deleting post:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete post",
    });
  }
});

// Update a post
router.put("/:postId", async (req, res) => {
  const { postId } = req.params;
  const { content, image_url } = req.body;

  // Validation
  if (!content || !content.trim()) {
    return res.status(400).json({
      error: "Content is required and cannot be empty",
    });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE Post 
         SET Content = ?, ImageURL = ?
         WHERE PostID = ?`,
        [content.trim(), image_url || null, postId],
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
      return res.status(404).json({ error: "Post not found" });
    }

    // Get the updated post with user details
    const currentUserId = req.user ? req.user.UserID : null;
    const updatedPost = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          p.PostID,
          p.UserID,
          p.Content,
          p.ImageURL,
          p.DatePosted,
          u.FirstName,
          u.LastName,
          u.JobTitle,
          CASE WHEN l.LikeID IS NOT NULL THEN 1 ELSE 0 END as IsLikedByUser
        FROM Post p
        LEFT JOIN User u ON p.UserID = u.UserID
        LEFT JOIN Like l ON p.PostID = l.PostID AND l.UserID = ?
        WHERE p.PostID = ?
        `,
        [currentUserId, postId],
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
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

module.exports = router;
