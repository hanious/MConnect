const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "community.db");
const communityDB = new sqlite3.Database(dbPath);

const hashPassword = async () => {
  try {
    return await bcrypt.hash("Test@123", 10);
  } catch (err) {
    console.error("Error hashing password:", err);
    return "Test@123";
  }
};

const initializeDB = async () => {
  const hashedPassword = await hashPassword();

  communityDB.serialize(() => {
    // Create tables
    communityDB.run(`
      CREATE TABLE IF NOT EXISTS User (
        UserID INTEGER PRIMARY KEY,
        FirstName TEXT NOT NULL,
        LastName TEXT NOT NULL,
        Email TEXT NOT NULL UNIQUE,
        Password TEXT,
        Company TEXT DEFAULT 'Unknown',
        JobTitle TEXT DEFAULT 'Unknown',
        Industry TEXT DEFAULT 'Other',
        AvatarPath TEXT DEFAULT NULL,
        DateJoined DATETIME DEFAULT (datetime('now', '+7 hours')),
        CommunityID INTEGER DEFAULT NULL,
        PermissionLevel TEXT DEFAULT 'User',
        AuthProvider TEXT DEFAULT 'local',
        GoogleID TEXT,  
        FOREIGN KEY (CommunityID) REFERENCES Community(CommunityID)
      )`);

    communityDB.run(`
      CREATE TABLE IF NOT EXISTS Community (
        CommunityID INTEGER PRIMARY KEY AUTOINCREMENT,
        CommunityName TEXT NOT NULL,
        Description TEXT NOT NULL,
        DateCreated DATETIME DEFAULT (datetime('now', '+7 hours')),
        AdminUserID INTEGER,
        FOREIGN KEY (AdminUserID) REFERENCES User(UserID)
      )`);

    // Create Post table
    communityDB.run(`
    CREATE TABLE IF NOT EXISTS Post (
      PostID INTEGER PRIMARY KEY AUTOINCREMENT,
      UserID INTEGER NOT NULL DEFAULT 1,
      Content TEXT NOT NULL,
      ImageURL TEXT,
      DatePosted DATETIME DEFAULT (datetime('now', '+7 hours')),
      FOREIGN KEY (UserID) REFERENCES User(UserID)
    )`);

    // Create Like table
    communityDB.run(
      `
    CREATE TABLE IF NOT EXISTS Like (
      LikeID INTEGER PRIMARY KEY AUTOINCREMENT,
      PostID INTEGER,
      CommentID INTEGER,
      UserID INTEGER NOT NULL,
      DateReacted DATETIME DEFAULT (datetime('now', '+7 hours')),
      FOREIGN KEY (PostID) REFERENCES Post(PostID) ON DELETE CASCADE,
      FOREIGN KEY (CommentID) REFERENCES Comment(CommentID) ON DELETE CASCADE,
      FOREIGN KEY (UserID) REFERENCES User(UserID) ON DELETE CASCADE,
      UNIQUE(PostID, UserID),
      UNIQUE(CommentID, UserID),
      CHECK ((PostID IS NOT NULL AND CommentID IS NULL) OR (PostID IS NULL AND CommentID IS NOT NULL))
    )`
    );

    communityDB.run(`
      CREATE TABLE IF NOT EXISTS Comment (
        CommentID INTEGER PRIMARY KEY,
        PostID INTEGER NOT NULL,
        UserID INTEGER NOT NULL,
        CommentText TEXT NOT NULL,
        DateCommented DATETIME DEFAULT (datetime('now', '+7 hours')),
        FOREIGN KEY (PostID) REFERENCES Post(PostID) ON DELETE CASCADE,
        FOREIGN KEY (UserID) REFERENCES User(UserID)
      )`);

    communityDB.run(`
      CREATE TABLE IF NOT EXISTS Notification (
        NotificationID INTEGER PRIMARY KEY,
        ReceiverID INTEGER NOT NULL,
        SenderID INTEGER NOT NULL,
        CommunityID INTEGER,
        Message TEXT NOT NULL,
        DateNotified DATETIME DEFAULT (datetime('now', '+7 hours')),
        IsRead BOOLEAN DEFAULT 0,
        FOREIGN KEY (ReceiverID) REFERENCES User(UserID),
        FOREIGN KEY (SenderID) REFERENCES User(UserID),
        FOREIGN KEY (CommunityID) REFERENCES Community(CommunityID)
      )`);

    // Create indexes for performance
    communityDB.run(
      `CREATE INDEX IF NOT EXISTS idx_post_userid ON Post(UserID)`
    );
    communityDB.run(
      `CREATE INDEX IF NOT EXISTS idx_like_postid ON Like(PostID)`
    );
    communityDB.run(
      `CREATE INDEX IF NOT EXISTS idx_like_commentid ON Like(CommentID)`
    );
    communityDB.run(
      `CREATE INDEX IF NOT EXISTS idx_like_userid ON Like(UserID)`
    );
    communityDB.run(
      `CREATE INDEX IF NOT EXISTS idx_notification_receiverid ON Notification(ReceiverID)`
    );
    communityDB.run(
      `CREATE INDEX IF NOT EXISTS idx_comment_postid ON Comment(PostID)`
    );
    communityDB.run(
      `CREATE INDEX IF NOT EXISTS idx_notification_senderid_communityid ON Notification(SenderID, CommunityID)`
    );

    // Insert default test user if needed
    communityDB.get("SELECT * FROM User WHERE UserID = 1", (err, row) => {
      if (err) return console.error("Error checking for test user:", err);

      if (!row) {
        communityDB.run(
          `
          INSERT INTO User (
            UserID, FirstName, LastName, Email, Password,
            Company, JobTitle, Industry, DateJoined, CommunityID, PermissionLevel
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+7 hours'), ?, ?)`,
          [
            1,
            "Test",
            "User",
            "test@example.com",
            hashedPassword,
            "Test Company",
            "Senior Engineer",
            "Utilities",
            1,
            "Admin",
          ],
          function (err) {
            if (err) return console.error("Error creating test user:", err);
            console.log(
              "✅ Test user created with ID: 1 and password 'Test@123'"
            );
            insertCommunityInfo();
          }
        );
      } else {
        console.log("✅ Test user already exists");
        insertCommunityInfo();
      }
    });

    function insertCommunityInfo() {
      communityDB.get("SELECT * FROM Community LIMIT 1", (err, row) => {
        if (err)
          return console.error("Error checking for community info:", err);

        if (!row) {
          communityDB.run(
            `
            INSERT INTO Community (CommunityName, Description, AdminUserID)
            VALUES (?, ?, ?)`,
            [
              "MConnect - Mining Community",
              "Welcome to MConnect, the premier platform for mining professionals...",
              1,
            ],
            function (err) {
              if (err)
                return console.error("Error creating community info:", err);
              console.log("✅ Community info created with AdminUserID 1");
              createTestPost();
            }
          );
        } else {
          console.log("✅ Community info already exists");
          createTestPost();
        }
      });
    }

    function createTestPost() {
      communityDB.get("SELECT * FROM Post WHERE PostID = 1", (err, row) => {
        if (err) return console.error("Error checking for test post:", err);

        if (!row) {
          communityDB.run(
            `
            INSERT INTO Post (PostID, UserID, Content, DatePosted)
            VALUES (1, 1, 'Welcome to MConnect! This is your first test post...', datetime('now', '+7 hours'))`,
            function (err) {
              if (err) return console.error("Error creating test post:", err);
              console.log("✅ Test post created with ID: 1");
              createTestComment();
            }
          );
        } else {
          console.log("✅ Test post already exists");
          createTestComment();
        }
      });
    }

    // Function to create test comment
    function createTestComment() {
      communityDB.get(
        "SELECT * FROM Comment WHERE CommentID = 1",
        (err, row) => {
          if (err) {
            console.error("❌ Error checking for test comment:", err);
            db.close();
            return;
          }

          if (!row) {
            communityDB.run(
              `INSERT INTO Comment (CommentID, PostID, UserID, CommentText, DateCommented)
           VALUES (1, 1, 1, 'This is a test comment! Great to see the community platform coming together. Looking forward to connecting with fellow mining professionals.', datetime('now', '+7 hours'))`,
              function (err) {
                if (err) {
                  console.error("Error creating test comment:", err);
                } else {
                  console.log("✅ Test comment created with ID: 1");
                }

                // Create test like after comment is created
                createTestLike();
              }
            );
          } else {
            console.log("✅ Test comment already exists");

            // Comment exists, check for test like
            createTestLike();
          }
        }
      );

      // Function to create test like
      function createTestLike() {
        communityDB.get(
          "SELECT * FROM Like WHERE UserID = 1 AND PostID = 1",
          (err, row) => {
            if (err) {
              console.error("Error checking for test like:", err);
              db.close();
              return;
            }

            if (!row) {
              communityDB.run(
                `INSERT INTO Like (PostID, UserID, DateReacted)
                VALUES (1, 1, datetime('now', '+7 hours'))`,
                function (err) {
                  if (err) {
                    console.error("Error creating test like:", err);
                  } else {
                    console.log("✅ Test like created");
                    finish();
                  }
                }
              );
            } else {
              console.log("✅ Test like already exists");
              finish();
            }
          }
        );
      }

      function finish() {
        communityDB.close((err) => {
          if (err) console.error("Error closing database:", err);
          else console.log("✅ Database initialization complete");
        });
      }
    }
  });
};

initializeDB();
