const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const router = express.Router();

// Database connection
const dbPath = path.join(__dirname, "../database/community.db");

// GET /api/likes/post/:postId - Get likes for a specific post
router.get("/post/:postId", (req, res) => {
  const postId = parseInt(req.params.postId);

  if (isNaN(postId)) {
    return res.status(400).json({ error: "Invalid post ID" });
  }

  const db = new sqlite3.Database(dbPath);

  // Get all likes for the post with user information
  db.all(
    `SELECT l.LikeID, l.UserID, l.DateReacted, u.FirstName, u.LastName
     FROM Like l
     JOIN User u ON l.UserID = u.UserID
     WHERE l.PostID = ?
     ORDER BY l.DateReacted DESC`,
    [postId],
    (err, rows) => {
      if (err) {
        console.error("Error fetching post likes:", err);
        db.close();
        return res.status(500).json({ error: "Failed to fetch likes" });
      }

      // Also get the total count
      db.get(
        "SELECT COUNT(*) as count FROM Like WHERE PostID = ?",
        [postId],
        (err, countResult) => {
          db.close();

          if (err) {
            console.error("Error counting post likes:", err);
            return res.status(500).json({ error: "Failed to count likes" });
          }

          res.json({
            likes: rows,
            totalLikes: countResult.count,
          });
        }
      );
    }
  );
});

// GET /api/likes/comment/:commentId - Get likes for a specific comment
router.get("/comment/:commentId", (req, res) => {
  const commentId = parseInt(req.params.commentId);

  if (isNaN(commentId)) {
    return res.status(400).json({ error: "Invalid comment ID" });
  }

  const db = new sqlite3.Database(dbPath);

  // Get all likes for the comment with user information
  db.all(
    `SELECT l.LikeID, l.UserID, l.DateReacted, u.FirstName, u.LastName
     FROM Like l
     JOIN User u ON l.UserID = u.UserID
     WHERE l.CommentID = ?
     ORDER BY l.DateReacted DESC`,
    [commentId],
    (err, rows) => {
      if (err) {
        console.error("Error fetching comment likes:", err);
        db.close();
        return res.status(500).json({ error: "Failed to fetch likes" });
      }

      // Also get the total count
      db.get(
        "SELECT COUNT(*) as count FROM Like WHERE CommentID = ?",
        [commentId],
        (err, countResult) => {
          db.close();

          if (err) {
            console.error("Error counting comment likes:", err);
            return res.status(500).json({ error: "Failed to count likes" });
          }

          res.json({
            likes: rows,
            totalLikes: countResult.count,
          });
        }
      );
    }
  );
});

// POST /api/likes/toggle - Toggle like for a post or comment
router.post("/toggle", (req, res) => {
  const { postId, commentId, userId } = req.body;

  // Validate input
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if ((!postId && !commentId) || (postId && commentId)) {
    return res
      .status(400)
      .json({
        error: "Either postId or commentId must be provided, but not both",
      });
  }

  const db = new sqlite3.Database(dbPath);

  // Check if like already exists
  const checkQuery = postId
    ? "SELECT LikeID FROM Like WHERE PostID = ? AND UserID = ?"
    : "SELECT LikeID FROM Like WHERE CommentID = ? AND UserID = ?";

  const checkParams = postId ? [postId, userId] : [commentId, userId];

  db.get(checkQuery, checkParams, (err, existingLike) => {
    if (err) {
      console.error("Error checking existing like:", err);
      db.close();
      return res.status(500).json({ error: "Failed to check like status" });
    }

    if (existingLike) {
      // Like exists, remove it (unlike)
      db.run(
        "DELETE FROM Like WHERE LikeID = ?",
        [existingLike.LikeID],
        function (err) {
          if (err) {
            console.error("Error removing like:", err);
            db.close();
            return res.status(500).json({ error: "Failed to remove like" });
          }

          // Get updated count
          const countQuery = postId
            ? "SELECT COUNT(*) as count FROM Like WHERE PostID = ?"
            : "SELECT COUNT(*) as count FROM Like WHERE CommentID = ?";

          const countParams = postId ? [postId] : [commentId];

          db.get(countQuery, countParams, (err, countResult) => {
            db.close();

            if (err) {
              console.error("Error counting likes after removal:", err);
              return res.status(500).json({ error: "Failed to count likes" });
            }

            res.json({
              action: "unliked",
              isLiked: false,
              totalLikes: countResult.count,
              message: "Like removed successfully",
            });
          });
        }
      );
    } else {
      // Like doesn't exist, add it
      const insertQuery = postId
        ? "INSERT INTO Like (PostID, UserID) VALUES (?, ?)"
        : "INSERT INTO Like (CommentID, UserID) VALUES (?, ?)";

      const insertParams = postId ? [postId, userId] : [commentId, userId];

      db.run(insertQuery, insertParams, function (err) {
        if (err) {
          console.error("Error adding like:", err);
          db.close();
          return res.status(500).json({ error: "Failed to add like" });
        }

        // Get updated count
        const countQuery = postId
          ? "SELECT COUNT(*) as count FROM Like WHERE PostID = ?"
          : "SELECT COUNT(*) as count FROM Like WHERE CommentID = ?";

        const countParams = postId ? [postId] : [commentId];

        db.get(countQuery, countParams, (err, countResult) => {
          db.close();

          if (err) {
            console.error("Error counting likes after addition:", err);
            return res.status(500).json({ error: "Failed to count likes" });
          }

          res.json({
            action: "liked",
            isLiked: true,
            totalLikes: countResult.count,
            likeId: this.lastID,
            message: "Like added successfully",
          });
        });
      });
    }
  });
});

// DELETE /api/likes/:likeId - Delete a specific like by ID
router.delete("/:likeId", (req, res) => {
  const likeId = parseInt(req.params.likeId);

  if (isNaN(likeId)) {
    return res.status(400).json({ error: "Invalid like ID" });
  }

  const db = new sqlite3.Database(dbPath);

  // Get the like details before deletion to return updated counts
  db.get(
    "SELECT PostID, CommentID FROM Like WHERE LikeID = ?",
    [likeId],
    (err, likeDetails) => {
      if (err) {
        console.error("Error fetching like details:", err);
        db.close();
        return res.status(500).json({ error: "Failed to fetch like details" });
      }

      if (!likeDetails) {
        db.close();
        return res.status(404).json({ error: "Like not found" });
      }

      // Delete the like
      db.run("DELETE FROM Like WHERE LikeID = ?", [likeId], function (err) {
        if (err) {
          console.error("Error deleting like:", err);
          db.close();
          return res.status(500).json({ error: "Failed to delete like" });
        }

        if (this.changes === 0) {
          db.close();
          return res.status(404).json({ error: "Like not found" });
        }

        // Get updated count
        const countQuery = likeDetails.PostID
          ? "SELECT COUNT(*) as count FROM Like WHERE PostID = ?"
          : "SELECT COUNT(*) as count FROM Like WHERE CommentID = ?";

        const countParams = likeDetails.PostID
          ? [likeDetails.PostID]
          : [likeDetails.CommentID];

        db.get(countQuery, countParams, (err, countResult) => {
          db.close();

          if (err) {
            console.error("Error counting likes after deletion:", err);
            return res.status(500).json({ error: "Failed to count likes" });
          }

          res.json({
            message: "Like deleted successfully",
            totalLikes: countResult.count,
            deletedLikeId: likeId,
          });
        });
      });
    }
  );
});

// GET /api/likes/user/:userId/status - Check if user has liked specific posts/comments
router.get("/user/:userId/status", (req, res) => {
  const userId = parseInt(req.params.userId);
  const { postIds, commentIds } = req.query;

  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const db = new sqlite3.Database(dbPath);
  const likeStatus = {};

  let queries = [];

  // Check post likes
  if (postIds) {
    const postIdArray = postIds
      .split(",")
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));
    if (postIdArray.length > 0) {
      const placeholders = postIdArray.map(() => "?").join(",");
      queries.push({
        type: "posts",
        query: `SELECT PostID FROM Like WHERE UserID = ? AND PostID IN (${placeholders})`,
        params: [userId, ...postIdArray],
      });
    }
  }

  // Check comment likes
  if (commentIds) {
    const commentIdArray = commentIds
      .split(",")
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));
    if (commentIdArray.length > 0) {
      const placeholders = commentIdArray.map(() => "?").join(",");
      queries.push({
        type: "comments",
        query: `SELECT CommentID FROM Like WHERE UserID = ? AND CommentID IN (${placeholders})`,
        params: [userId, ...commentIdArray],
      });
    }
  }

  if (queries.length === 0) {
    db.close();
    return res.json({ likeStatus: {} });
  }

  let completedQueries = 0;

  queries.forEach(({ type, query, params }) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Error checking ${type} like status:`, err);
        db.close();
        return res
          .status(500)
          .json({ error: `Failed to check ${type} like status` });
      }

      if (type === "posts") {
        rows.forEach((row) => {
          likeStatus[`post_${row.PostID}`] = true;
        });
      } else {
        rows.forEach((row) => {
          likeStatus[`comment_${row.CommentID}`] = true;
        });
      }

      completedQueries++;
      if (completedQueries === queries.length) {
        db.close();
        res.json({ likeStatus });
      }
    });
  });
});

module.exports = router;
