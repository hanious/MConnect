// ======================
// 1. REQUIRE DEPENDENCIES
// ======================
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const bcrypt = require("bcrypt");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

// Routers (authRouter will receive passport as argument)
const communityRouter = require("./routes/community");
const postsRouter = require("./routes/posts");
const commentsRouter = require("./routes/comments");
const likesRouter = require("./routes/likes");
const notificationsRouter = require("./routes/notifications");
const usersRouter = require("./routes/users");

// ======================
// 2. CONFIGURATION CHECK
// ======================
const requiredEnvVars = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SESSION_SECRET",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error("❌ Missing environment variables:", missingVars);
  console.log("Please check your .env file in:", path.join(__dirname, ".env"));
  process.exit(1);
}

// ======================
// 3. DATABASE SETUP
// ======================
const dbPath = path.join(__dirname, "database", "community.db");

// Verify database file exists or create it
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, "");
}

const db = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error("❌ Database connection error:", err.message);
      process.exit(1);
    }
    console.log("✅ Connected to SQLite database at:", dbPath);

    // Verify User table exists or create it
    db.exec(
      `
    CREATE TABLE IF NOT EXISTS User (
      UserID INTEGER PRIMARY KEY AUTOINCREMENT,
      FirstName TEXT,
      LastName TEXT,
      Email TEXT UNIQUE NOT NULL,
      Password TEXT,
      Company TEXT,
      JobTitle TEXT,
      Industry TEXT,
      AuthProvider TEXT DEFAULT 'google',
      GoogleID TEXT,
      DateJoined DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
      (err) => {
        if (err) {
          console.error("❌ Failed to create User table:", err.message);
          process.exit(1);
        }
      }
    );
  }
);

// ======================
// 4. EXPRESS SETUP
// ======================
const app = express();
const port = process.env.PORT || 3000;

// Create session store for manual cleanup
const sessionStore = new (require("express-session").MemoryStore)();

// Track logged out users to prevent automatic re-authentication
const loggedOutUsers = new Set();

const allowedOrigins = ["http://127.0.0.1:5500", "http://localhost:5500"];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.some(
          (allowedOrigin) =>
            origin === allowedOrigin ||
            origin.replace("127.0.0.1", "localhost") === allowedOrigin
        )
      ) {
        callback(null, true);
      } else {
        console.warn("⚠️ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // This allows cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "connect.sid", // Explicit session name
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true, // Prevent XSS
    },
    // Force session save on every request to ensure proper cleanup
    rolling: true,
    // Store session data in memory with cleanup
    store: sessionStore,
  })
);

// ======================
// 5. PASSPORT SETUP
// ======================
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://127.0.0.1:3000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile.emails?.[0]?.value) {
          throw new Error("No email provided by Google");
        }

        // Hash the GoogleID
        const hashedGoogleId = await bcrypt.hash(profile.id, 10);

        db.get(
          "SELECT * FROM User WHERE Email = ?",
          [profile.emails[0].value],
          async (err, user) => {
            if (err) return done(err);

            if (user) {
              // Existing user - only update GoogleID if missing (leave CommunityID unchanged)
              if (!user.GoogleID) {
                db.run("UPDATE User SET GoogleID = ? WHERE UserID = ?", [
                  hashedGoogleId,
                  user.UserID,
                ]);
                user.GoogleID = hashedGoogleId;
              }
              return done(null, user);
            }

            // New user - set CommunityID to NULL explicitly
            const newUser = {
              GoogleID: hashedGoogleId,
              FirstName: profile.name?.givenName || "Google",
              LastName: profile.name?.familyName || "User",
              Email: profile.emails[0].value,
              Password: "",
              Company: "Unknown",
              JobTitle: "Unknown",
              Industry: "Other",
              AuthProvider: "google",
              CommunityID: null, // Explicitly set to NULL for new Google users
            };

            db.run(
              `INSERT INTO User (
                FirstName, LastName, Email, Password, 
                Company, JobTitle, Industry, AuthProvider, GoogleID, CommunityID
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                newUser.FirstName,
                newUser.LastName,
                newUser.Email,
                newUser.Password,
                newUser.Company,
                newUser.JobTitle,
                newUser.Industry,
                newUser.AuthProvider,
                newUser.GoogleID,
                newUser.CommunityID,
              ],
              function (err) {
                if (err) {
                  console.error("Database insert error:", err);
                  return done(err);
                }
                newUser.UserID = this.lastID;
                return done(null, newUser);
              }
            );
          }
        );
      } catch (err) {
        return done(err);
      }
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user.UserID);
});

passport.deserializeUser((id, done) => {
  console.log("Deserializing user with ID:", id);

  // Add validation to ensure ID exists
  if (!id) {
    console.log("No user ID to deserialize");
    return done(null, false);
  }

  // Check if this user was explicitly logged out
  if (loggedOutUsers.has(id.toString())) {
    console.log("User", id, "was logged out, preventing re-authentication");
    return done(null, false);
  }

  db.get("SELECT * FROM User WHERE UserID = ?", [id], (err, user) => {
    if (err) {
      console.error("Deserialize user error:", err);
      return done(err);
    }
    if (!user) {
      console.log("No user found for ID:", id);
      return done(null, false);
    }
    console.log("Successfully deserialized user:", user.UserID);
    return done(null, user);
  });
});

// ======================
// 6. ROUTES
// ======================

// Modular API routes
const authRouter = require("./routes/auth")(
  passport,
  sessionStore,
  loggedOutUsers
);
app.use("/api/auth", authRouter);
app.use("/api/community", communityRouter);
app.use("/api/posts", postsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/likes", likesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/users", usersRouter);

app.get("/api/current-user", (req, res) => {
  console.log("=== Current User Check ===");
  console.log(
    "isAuthenticated():",
    req.isAuthenticated ? req.isAuthenticated() : "function not available"
  );
  console.log("req.user exists:", !!req.user);
  console.log("req.session exists:", !!req.session);
  console.log(
    "session.passport:",
    req.session ? req.session.passport : "no session"
  );
  console.log("========================");

  if (req.isAuthenticated()) {
    res.json({
      user: {
        id: req.user.UserID,
        email: req.user.Email,
        firstName: req.user.FirstName,
        lastName: req.user.LastName,
        CommunityID: req.user.CommunityID || null,
      },
    });
  } else {
    // Clear the session cookie if not authenticated
    res.clearCookie("connect.sid", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.status(200).json({ user: null }); // Use 200 instead of 401 for better frontend handling
  }
});

app.get("/api/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    req.session.destroy(function (err) {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
      res.redirect("/");
    });
  });
});

// ======================
// 7. ERROR HANDLING
// ======================
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ======================
// 8. START SERVER
// ======================
app.listen(port, () => {
  console.log(`
  🚀 Server running on http://localhost:${port}
  🔐 Google OAuth configured for client ID: ${process.env.GOOGLE_CLIENT_ID}
  🌍 CORS enabled for: ${process.env.FRONTEND_URL || "http://127.0.0.1:5500"}
  `);
});
