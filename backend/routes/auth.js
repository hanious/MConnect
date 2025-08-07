const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const dbPath = path.join(__dirname, "../database/community.db");

module.exports = function (passport, sessionStore, loggedOutUsers) {
  const router = express.Router();

  // Reusable function to clear all authentication cookies
  const clearAllCookies = (res) => {
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    // Clear all possible session-related cookies
    res.clearCookie("connect.sid", cookieOptions);
    res.clearCookie("session", cookieOptions);
    res.clearCookie("_session", cookieOptions);
    res.clearCookie("sess", cookieOptions);

    // Clear potential Google OAuth cookies
    res.clearCookie("google.oauth.state", cookieOptions);
    res.clearCookie("oauth2_state", cookieOptions);
    res.clearCookie("oauth_state", cookieOptions);

    // Clear any other authentication cookies
    res.clearCookie("auth", cookieOptions);
    res.clearCookie("token", cookieOptions);
  };

  // Signup endpoint
  router.post("/signup", async (req, res) => {
    const {
      firstName,
      lastName,
      email,
      password,
      company,
      jobTitle,
      industry,
    } = req.body;

    // Check for required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !company ||
      !jobTitle ||
      !industry
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Input sanitization function
    const sanitizeDisplayText = (input) => {
      if (!input || typeof input !== "string") {
        return "";
      }

      return input
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Sanitize input data before storing
      const sanitizedFirstName = sanitizeDisplayText(firstName);
      const sanitizedLastName = sanitizeDisplayText(lastName);
      const sanitizedCompany = sanitizeDisplayText(company);
      const sanitizedJobTitle = sanitizeDisplayText(jobTitle);
      const sanitizedIndustry = sanitizeDisplayText(industry);

      // Additional validation for sanitized data
      if (sanitizedFirstName.length < 1 || sanitizedLastName.length < 1) {
        return res
          .status(400)
          .json({ error: "First name and last name are required" });
      }

      if (sanitizedCompany.length < 1) {
        return res.status(400).json({ error: "Company name is required" });
      }

      if (sanitizedJobTitle.length < 1 || sanitizedIndustry.length < 1) {
        return res
          .status(400)
          .json({ error: "Job title and industry are required" });
      }

      const query = `
        INSERT INTO User (FirstName, LastName, Email, Password, Company, JobTitle, Industry, DateJoined, CommunityID, PermissionLevel)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, 'User')
      `;

      const db = new sqlite3.Database(dbPath);
      db.run(
        query,
        [
          sanitizedFirstName,
          sanitizedLastName,
          email.toLowerCase().trim(),
          hashedPassword,
          sanitizedCompany,
          sanitizedJobTitle,
          sanitizedIndustry,
        ],
        function (err) {
          db.close();
          if (err) {
            if (err.message.includes("UNIQUE constraint failed: User.Email")) {
              return res.status(400).json({ error: "Email already exists" });
            }
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
          }
          res.status(201).json({
            message: "User registered successfully",
            userId: this.lastID,
          });
        }
      );
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Login endpoint
  router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const db = new sqlite3.Database(dbPath);

    db.get(`SELECT * FROM User WHERE Email = ?`, [email], async (err, user) => {
      db.close();

      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      try {
        const match = await bcrypt.compare(password, user.Password);
        if (!match) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        // Remove user from logged out set since they're logging in
        const userId = user.UserID.toString();
        if (loggedOutUsers.has(userId)) {
          loggedOutUsers.delete(userId);
        }

        res.json({
          success: true,
          user: {
            id: user.UserID,
            email: user.Email,
            firstName: user.FirstName,
            lastName: user.LastName,
            PermissionLevel: user.PermissionLevel,
            CommunityID: user.CommunityID,
          },
        });
      } catch (error) {
        console.error("Password compare error:", error);
        res.status(500).json({ error: "Server error" });
      }
    });
  });

  // Google OAuth endpoints
  router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      failureRedirect:
        "http://127.0.0.1:5500/frontend/pages/login.html?error=auth_failed",
    }),
    (req, res) => {
      if (!req.user) {
        return res.redirect(
          "http://127.0.0.1:5500/frontend/pages/login.html?error=auth_failed"
        );
      }

      // Explicitly set CommunityID to null if it's not already set
      const userData = {
        id: req.user.UserID,
        email: req.user.Email,
        firstName: req.user.FirstName || "Google",
        lastName: req.user.LastName || "User",
        CommunityID: req.user.CommunityID || null,
      };

      // Remove user from logged out set since they're logging in
      if (req.user && req.user.UserID) {
        const userId = req.user.UserID.toString();
        if (loggedOutUsers.has(userId)) {
          loggedOutUsers.delete(userId);
        }
      }

      res.redirect(
        `http://127.0.0.1:5500/frontend/pages/community.html?googleAuthSuccess=1&user=${encodeURIComponent(
          JSON.stringify(userData)
        )}`
      );
    }
  );

  // Current user endpoint for session-based auth (Google OAuth)
  router.get("/current-user", (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      const { Password, ...user } = req.user;
      res.json({ user: { ...user, CommunityID: req.user.CommunityID } });
    } else {
      // Force cleanup of any orphaned session
      if (req.session) {
        const sessionId = req.session.id;
        req.session.destroy(() => {
          // Clear cookies
          res.clearCookie("connect.sid", {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          });
          res.clearCookie("session");
          res.status(401).json({ user: null });
        });
      } else {
        res.status(401).json({ user: null });
      }
    }
  });

  // Logout endpoint
  router.post("/logout", (req, res) => {
    // Add user to logged out set before logout
    if (req.user && req.user.UserID) {
      const userId = req.user.UserID.toString();
      loggedOutUsers.add(userId);
      console.log("Added user", userId, "to logged out users set");
    }

    if (req.logout) {
      req.logout((err) => {
        if (err) {
          console.error("Logout error:", err);
          clearAllCookies(res);
          return res.status(500).json({ error: "Logout failed" });
        }

        if (req.session) {
          req.session.destroy((err) => {
            if (err) {
              console.error("Session destroy error:", err);
            }
            clearAllCookies(res);
            res.json({ success: true, message: "Logged out successfully" });
          });
        } else {
          clearAllCookies(res);
          res.json({ success: true, message: "Logged out successfully" });
        }
      });
    } else {
      clearAllCookies(res);
      res.json({ success: true, message: "Already logged out" });
    }
  });

  // Google-specific logout endpoint
  router.post("/google/logout", (req, res) => {
    // Add user to logged out set before logout
    if (req.user && req.user.UserID) {
      const userId = req.user.UserID.toString();
      loggedOutUsers.add(userId);
    }

    const forceSessionDestroy = (callback) => {
      if (req.session) {
        // Force session data to be null
        req.session.passport = null;
        req.session.user = null;

        req.session.destroy((err) => {
          if (err) {
            console.error("Session destroy error:", err);
          }

          // Also manually clear request properties
          req.user = null;
          req.session = null;

          callback();
        });
      } else {
        // Also clear request properties even if no session
        req.user = null;
        callback();
      }
    };

    const completeLogout = () => {
      clearAllCookies(res);
      res.json({
        success: true,
        message: "Google logout successful",
        sessionCleared: true,
      });
    };

    // First try Passport logout
    if (req.logout) {
      req.logout((err) => {
        if (err) {
          console.error("Passport logout error:", err);
        }
        forceSessionDestroy(completeLogout);
      });
    } else {
      forceSessionDestroy(completeLogout);
    }
  });

  // Session verification endpoint for debugging
  router.get("/verify-session", (req, res) => {
    const sessionInfo = {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      hasSession: !!req.session,
      hasUser: !!req.user,
      sessionId: req.session ? req.session.id : null,
      passportSession: req.session ? req.session.passport : null,
      timestamp: new Date().toISOString(),
    };

    res.json(sessionInfo);
  });

  // Force session cleanup endpoint - for troubleshooting persistent sessions
  router.post("/cleanup-session", (req, res) => {
    // Force logout if user is logged in
    if (req.logout) {
      req.logout((err) => {
        if (err) {
          console.error("Force logout error:", err);
        }

        // Force session destruction
        if (req.session) {
          req.session.destroy((err) => {
            if (err) {
              console.error("Force session destroy error:", err);
            }
            clearAllCookies(res);
            res.json({ success: true, message: "Session forcefully cleaned" });
          });
        } else {
          clearAllCookies(res);
          res.json({ success: true, message: "Session forcefully cleaned" });
        }
      });
    } else {
      // No logout function, just clear everything
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destroy error:", err);
          }
          clearAllCookies(res);
          res.json({ success: true, message: "Session forcefully cleaned" });
        });
      } else {
        clearAllCookies(res);
        res.json({ success: true, message: "Session forcefully cleaned" });
      }
    }
  });

  // Debug endpoint to check session store contents
  router.get("/debug-sessions", (req, res) => {
    if (sessionStore && sessionStore.sessions) {
      const sessions = sessionStore.sessions;
      const sessionIds = Object.keys(sessions);
      const sessionData = sessionIds.map((id) => ({
        id,
        passport: sessions[id].passport,
        authenticated: !!sessions[id].passport?.user,
      }));

      res.json({
        totalSessions: sessionIds.length,
        sessions: sessionData,
      });
    } else {
      res.json({ message: "Session store not accessible or empty" });
    }
  });

  // Clear all sessions endpoint (nuclear option)
  router.post("/clear-all-sessions", (req, res) => {
    console.log("Clearing all sessions...");

    // Clear the logged out users set
    const loggedOutCount = loggedOutUsers.size;
    loggedOutUsers.clear();
    console.log("Cleared", loggedOutCount, "users from logged out set");

    // Use the passed session store
    if (sessionStore && typeof sessionStore.clear === "function") {
      sessionStore.clear((err) => {
        if (err) {
          console.error("Error clearing session store:", err);
          return res.status(500).json({ error: "Failed to clear sessions" });
        }
        console.log("All sessions cleared from store");
        res.json({ success: true, message: "All sessions cleared" });
      });
    } else if (sessionStore && sessionStore.sessions) {
      // For MemoryStore, manually clear the sessions object
      try {
        const sessionCount = Object.keys(sessionStore.sessions).length;
        sessionStore.sessions = {};
        res.json({
          success: true,
          message: `${sessionCount} sessions cleared`,
        });
      } catch (err) {
        console.error("Error manually clearing sessions:", err);
        res.status(500).json({ error: "Failed to clear sessions" });
      }
    } else {
      res.json({ success: true, message: "Session store clear not available" });
    }
  });

  return router;
};
