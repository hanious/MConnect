const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "community.db");
const db = new sqlite3.Database(dbPath);

// Valid JobTitles and Industries from profile.js
const JOB_TITLES = [
  "Operations Manager",
  "Senior Engineer",
  "Safety Coordinator",
  "Project Manager",
  "Field Supervisor",
  "Technical Specialist",
  "Other",
];

const INDUSTRIES = [
  "Mining & Minerals",
  "Oil & Gas",
  "Renewable Energy",
  "Utilities",
  "Construction",
  "Other",
];

// Sample data arrays
const FIRST_NAMES = [
  "James",
  "Mary",
  "John",
  "Patricia",
  "Robert",
  "Jennifer",
  "Michael",
  "Linda",
  "William",
  "Elizabeth",
  "David",
  "Barbara",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Christopher",
  "Karen",
  "Charles",
  "Nancy",
  "Daniel",
  "Lisa",
  "Matthew",
  "Betty",
  "Anthony",
  "Helen",
  "Mark",
  "Sandra",
  "Donald",
  "Donna",
  "Steven",
  "Carol",
  "Paul",
  "Ruth",
  "Andrew",
  "Sharon",
  "Joshua",
  "Michelle",
  "Kenneth",
  "Laura",
  "Kevin",
  "Sarah",
  "Brian",
  "Kimberly",
  "George",
  "Deborah",
  "Edward",
  "Dorothy",
  "Ronald",
  "Lisa",
  "Timothy",
  "Nancy",
  "Jason",
  "Karen",
  "Jeffrey",
  "Betty",
  "Ryan",
  "Helen",
  "Jacob",
  "Sandra",
  "Gary",
  "Donna",
  "Nicholas",
  "Carol",
  "Eric",
  "Ruth",
  "Jonathan",
  "Sharon",
  "Stephen",
  "Michelle",
  "Larry",
  "Laura",
  "Justin",
  "Sarah",
  "Scott",
  "Kimberly",
  "Brandon",
  "Deborah",
  "Benjamin",
  "Dorothy",
  "Samuel",
  "Amy",
  "Gregory",
  "Angela",
  "Alexander",
  "Ashley",
  "Frank",
  "Brenda",
  "Raymond",
  "Emma",
  "Jack",
  "Olivia",
  "Dennis",
  "Cynthia",
  "Jerry",
  "Marie",
  "Tyler",
  "Janet",
  "Aaron",
  "Catherine",
  "Jose",
  "Frances",
  "Henry",
  "Christine",
  "Adam",
  "Samantha",
  "Douglas",
  "Debra",
  "Nathan",
  "Rachel",
  "Peter",
  "Carolyn",
  "Zachary",
  "Janet",
  "Kyle",
  "Virginia",
  "Noah",
  "Maria",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
  "Gomez",
  "Phillips",
  "Evans",
  "Turner",
  "Diaz",
  "Parker",
  "Cruz",
  "Edwards",
  "Collins",
  "Reyes",
  "Stewart",
  "Morris",
  "Morales",
  "Murphy",
  "Cook",
  "Rogers",
  "Gutierrez",
  "Ortiz",
  "Morgan",
  "Cooper",
  "Peterson",
  "Bailey",
  "Reed",
  "Kelly",
  "Howard",
  "Ramos",
  "Kim",
  "Cox",
  "Ward",
  "Richardson",
  "Watson",
  "Brooks",
  "Chavez",
  "Wood",
  "James",
  "Bennett",
  "Gray",
  "Mendoza",
  "Ruiz",
  "Hughes",
  "Price",
  "Alvarez",
  "Castillo",
  "Sanders",
  "Patel",
  "Myers",
];

const COMPANIES = [
  "Horizon Mining Corp",
  "Apex Energy Solutions",
  "Summit Resources Ltd",
  "Global Mining Partners",
  "Titan Industrial Group",
  "Phoenix Energy Systems",
  "Atlas Mining Company",
  "Meridian Resources",
  "Vanguard Energy Corp",
  "Pioneer Mining Solutions",
  "Catalyst Energy Group",
  "Nexus Resources Ltd",
  "Pinnacle Mining Co",
  "Vertex Energy Systems",
  "Quantum Resources Inc",
  "Eclipse Mining Group",
  "Skyline Energy Corp",
  "Infinity Resources Ltd",
  "Matrix Mining Solutions",
  "Zenith Energy Group",
  "Sterling Resources Inc",
  "Cosmos Mining Corp",
  "Prism Energy Solutions",
  "Velocity Resources Ltd",
  "Fusion Mining Group",
  "Orbit Energy Systems",
  "Spectrum Resources Inc",
  "Nova Mining Solutions",
  "Stellar Energy Corp",
  "Radiant Resources Ltd",
  "Dynamics Mining Group",
  "Pulse Energy Solutions",
  "Frontier Resources Inc",
  "Synergy Mining Corp",
  "Momentum Energy Group",
  "Cornerstone Resources",
  "Blueprint Mining Solutions",
  "Flagship Energy Corp",
  "Foundation Resources Ltd",
  "Keystone Mining",
  null,
  null,
  null, // Some null values as requested
];

const EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "company.com",
  "mining.com",
  "energy.com",
  "industrial.com",
  "corporate.com",
  "professional.com",
];

const POST_CONTENT_TEMPLATES = [
  "Just completed a successful safety inspection at our mining site. Safety always comes first! #MiningLife #Safety",
  "Excited to share our latest project milestone. The team's dedication is truly inspiring. #Teamwork #Mining",
  "New equipment installation went smoothly today. Technology is revolutionizing our industry! #Innovation #Mining",
  "Great networking session at the industry conference. Always learning from fellow professionals. #Networking #Mining",
  "Proud of our environmental sustainability initiatives. We're making a difference! #Sustainability #GreenMining",
  "Training session on new safety protocols completed. Knowledge sharing is crucial. #Training #Safety",
  "Another successful day in the field. Love what I do! #Mining #Passion",
  "Collaborating with engineers on optimization strategies. Great minds think alike! #Engineering #Optimization",
  "Weather conditions challenging today, but the team persevered. #Resilience #Mining",
  "Celebrating our team's achievement in meeting production targets! #Success #TeamWork",
  "Implementing new digital solutions to improve efficiency. The future is now! #DigitalTransformation #Mining",
  "Safety meeting highlighted important risk management strategies. #SafetyFirst #RiskManagement",
  "Mentoring new team members is always rewarding. Passing on knowledge! #Mentorship #Growth",
  "Equipment maintenance completed ahead of schedule. Preventive care matters! #Maintenance #Efficiency",
  "Field observations reveal interesting geological formations. Science in action! #Geology #Discovery",
  "Cross-departmental collaboration yielding excellent results. #Collaboration #Results",
  "Industry best practices workshop was incredibly informative. #BestPractices #Learning",
  "Environmental monitoring shows positive trends. Responsible mining works! #Environment #ResponsibleMining",
  "Emergency response drill went perfectly. Preparedness is key! #EmergencyResponse #Preparedness",
  "Quality control measures ensuring top-notch standards. #QualityControl #Standards",
];

const COMMENT_TEMPLATES = [
  "Great work! Keep it up!",
  "Thanks for sharing this insight.",
  "Very informative post, learned a lot.",
  "Impressive results! Congratulations!",
  "Safety first, always appreciate these reminders.",
  "Excellent teamwork on this project.",
  "Looking forward to more updates like this.",
  "This is exactly what our industry needs.",
  "Inspiring to see such dedication.",
  "Thanks for the valuable information.",
  "Great progress on the project!",
  "Your experience is truly valuable.",
  "Appreciate you sharing your knowledge.",
  "This approach seems very effective.",
  "Well done to the entire team!",
  "Innovation at its finest!",
  "This is a game-changer for our industry.",
  "Excellent attention to detail.",
  "Your expertise really shows.",
  "Thanks for the professional insights.",
];

// Utility functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const randomTime =
    startDate.getTime() +
    Math.random() * (endDate.getTime() - startDate.getTime());
  return new Date(randomTime).toISOString().replace("T", " ").substring(0, 19);
}

function generateEmail(firstName, lastName, domain) {
  const variations = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
    `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@${domain}`,
    `${firstName.toLowerCase()}${lastName.charAt(0).toLowerCase()}@${domain}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}@${domain}`,
  ];
  return getRandomElement(variations);
}

async function hashPassword(password) {
  try {
    return await bcrypt.hash(password, 10);
  } catch (err) {
    console.error("Error hashing password:", err);
    return password;
  }
}

// Data generation functions
async function generateUsers(count = 500) {
  console.log(`🔄 Generating ${count} users...`);
  const defaultPassword = await hashPassword("Password123!");
  const users = [];
  const usedEmails = new Set();

  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    const domain = getRandomElement(EMAIL_DOMAINS);

    let email;
    let attempts = 0;
    do {
      email = generateEmail(firstName, lastName, domain);
      attempts++;
      if (attempts > 10) {
        email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`;
        break;
      }
    } while (usedEmails.has(email));

    usedEmails.add(email);

    const user = {
      firstName,
      lastName,
      email,
      password: defaultPassword,
      company: Math.random() < 0.8 ? getRandomElement(COMPANIES) : null,
      jobTitle: getRandomElement(JOB_TITLES),
      industry: getRandomElement(INDUSTRIES),
      dateJoined: getRandomDate("2023-01-01", "2024-12-31"),
      communityId: Math.random() < 0.85 ? 1 : null, // 85% join the community
      permissionLevel: "User",
      authProvider: Math.random() < 0.7 ? "local" : "google",
      googleId:
        Math.random() < 0.3
          ? `google_${Math.random().toString(36).substring(2, 15)}`
          : null,
    };

    users.push(user);
  }

  return users;
}

function generatePosts(userCount, postsCount = 800) {
  console.log(`🔄 Generating ${postsCount} posts...`);
  const posts = [];

  for (let i = 0; i < postsCount; i++) {
    const post = {
      userId: Math.floor(Math.random() * userCount) + 2, // Start from 2 (skip admin)
      content: getRandomElement(POST_CONTENT_TEMPLATES),
      imageUrl:
        Math.random() < 0.2
          ? `https://via.placeholder.com/400x300?text=Post+Image+${i + 1}`
          : null,
      datePosted: getRandomDate("2023-06-01", "2024-12-31"),
    };
    posts.push(post);
  }

  return posts;
}

function generateComments(userCount, postCount, commentsCount = 1200) {
  console.log(`🔄 Generating ${commentsCount} comments...`);
  const comments = [];

  for (let i = 0; i < commentsCount; i++) {
    const comment = {
      postId: Math.floor(Math.random() * postCount) + 1,
      userId: Math.floor(Math.random() * userCount) + 1,
      commentText: getRandomElement(COMMENT_TEMPLATES),
      dateCommented: getRandomDate("2023-06-01", "2024-12-31"),
    };
    comments.push(comment);
  }

  return comments;
}

function generateLikes(userCount, postCount, commentCount, likesCount = 2000) {
  console.log(`🔄 Generating ${likesCount} likes...`);
  const likes = [];
  const existingLikes = new Set();

  for (let i = 0; i < likesCount; i++) {
    const isPostLike = Math.random() < 0.7; // 70% post likes, 30% comment likes
    const userId = Math.floor(Math.random() * userCount) + 1;

    let postId = null;
    let commentId = null;
    let likeKey;

    if (isPostLike) {
      postId = Math.floor(Math.random() * postCount) + 1;
      likeKey = `post_${postId}_user_${userId}`;
    } else {
      commentId = Math.floor(Math.random() * commentCount) + 1;
      likeKey = `comment_${commentId}_user_${userId}`;
    }

    // Ensure no duplicate likes
    if (existingLikes.has(likeKey)) {
      continue;
    }

    existingLikes.add(likeKey);

    const like = {
      postId,
      commentId,
      userId,
      dateReacted: getRandomDate("2023-06-01", "2024-12-31"),
    };

    likes.push(like);
  }

  return likes;
}

// Database insertion functions
function insertUsers(users) {
  return new Promise((resolve, reject) => {
    console.log("📝 Inserting users into database...");
    const stmt = db.prepare(`
      INSERT INTO User (FirstName, LastName, Email, Password, Company, JobTitle, Industry, DateJoined, CommunityID, PermissionLevel, AuthProvider, GoogleID)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let completed = 0;
    const total = users.length;

    users.forEach((user, index) => {
      stmt.run(
        [
          user.firstName,
          user.lastName,
          user.email,
          user.password,
          user.company,
          user.jobTitle,
          user.industry,
          user.dateJoined,
          user.communityId,
          user.permissionLevel,
          user.authProvider,
          user.googleId,
        ],
        function (err) {
          if (err) {
            console.error(`❌ Error inserting user ${index + 1}:`, err.message);
          } else {
            completed++;
            if (completed % 50 === 0) {
              console.log(`   Progress: ${completed}/${total} users inserted`);
            }
          }

          if (completed === total) {
            stmt.finalize();
            console.log("✅ All users inserted successfully");
            resolve();
          }
        }
      );
    });
  });
}

function insertPosts(posts) {
  return new Promise((resolve, reject) => {
    console.log("📝 Inserting posts into database...");
    const stmt = db.prepare(`
      INSERT INTO Post (UserID, Content, ImageURL, DatePosted)
      VALUES (?, ?, ?, ?)
    `);

    let completed = 0;
    const total = posts.length;

    posts.forEach((post, index) => {
      stmt.run(
        [post.userId, post.content, post.imageUrl, post.datePosted],
        function (err) {
          if (err) {
            console.error(`❌ Error inserting post ${index + 1}:`, err.message);
          } else {
            completed++;
            if (completed % 50 === 0) {
              console.log(`   Progress: ${completed}/${total} posts inserted`);
            }
          }

          if (completed === total) {
            stmt.finalize();
            console.log("✅ All posts inserted successfully");
            resolve();
          }
        }
      );
    });
  });
}

function insertComments(comments) {
  return new Promise((resolve, reject) => {
    console.log("📝 Inserting comments into database...");
    const stmt = db.prepare(`
      INSERT INTO Comment (PostID, UserID, CommentText, DateCommented)
      VALUES (?, ?, ?, ?)
    `);

    let completed = 0;
    const total = comments.length;

    comments.forEach((comment, index) => {
      stmt.run(
        [
          comment.postId,
          comment.userId,
          comment.commentText,
          comment.dateCommented,
        ],
        function (err) {
          if (err) {
            console.error(
              `❌ Error inserting comment ${index + 1}:`,
              err.message
            );
          } else {
            completed++;
            if (completed % 50 === 0) {
              console.log(
                `   Progress: ${completed}/${total} comments inserted`
              );
            }
          }

          if (completed === total) {
            stmt.finalize();
            console.log("✅ All comments inserted successfully");
            resolve();
          }
        }
      );
    });
  });
}

function insertLikes(likes) {
  return new Promise((resolve, reject) => {
    console.log("📝 Inserting likes into database...");
    const stmt = db.prepare(`
      INSERT INTO Like (PostID, CommentID, UserID, DateReacted)
      VALUES (?, ?, ?, ?)
    `);

    let completed = 0;
    const total = likes.length;

    likes.forEach((like, index) => {
      stmt.run(
        [like.postId, like.commentId, like.userId, like.dateReacted],
        function (err) {
          if (err) {
            console.error(`❌ Error inserting like ${index + 1}:`, err.message);
          } else {
            completed++;
            if (completed % 100 === 0) {
              console.log(`   Progress: ${completed}/${total} likes inserted`);
            }
          }

          if (completed === total) {
            stmt.finalize();
            console.log("✅ All likes inserted successfully");
            resolve();
          }
        }
      );
    });
  });
}

// Main execution function
async function generateAllData() {
  try {
    console.log("🚀 Starting data generation for MConnect database...\n");

    // Check if admin user exists
    const adminExists = await new Promise((resolve) => {
      db.get("SELECT * FROM User WHERE UserID = 1", (err, row) => {
        if (err) {
          console.error("❌ Error checking for admin user:", err);
          resolve(false);
        } else {
          resolve(!!row);
        }
      });
    });

    if (!adminExists) {
      console.log("❌ Admin user not found. Please run init.js first.");
      process.exit(1);
    }

    console.log("✅ Admin user found, proceeding with data generation...\n");

    // Generate data
    const userCount = 500;
    const users = await generateUsers(userCount);
    const posts = generatePosts(userCount, 800);
    const comments = generateComments(userCount, 800, 1200);
    const likes = generateLikes(userCount, 800, 1200, 2000);

    // Insert data sequentially
    await insertUsers(users);
    await insertPosts(posts);
    await insertComments(comments);
    await insertLikes(likes);

    // Display summary
    console.log("\n📊 Data Generation Summary:");
    console.log(`   👥 Users: ${userCount} (+ 1 admin)`);
    console.log(`   📝 Posts: ${posts.length} (+ 1 test post)`);
    console.log(`   💬 Comments: ${comments.length} (+ 1 test comment)`);
    console.log(`   👍 Likes: ${likes.length} (+ 1 test like)`);
    console.log(`   🏢 Community: 1 (MConnect)`);
    console.log("   🔔 Notifications: 0 (as requested)");

    console.log("\n✅ Database population completed successfully!");
    console.log("\n📋 Data Characteristics:");
    console.log("   • 85% of users joined the community");
    console.log("   • 30% of users use Google auth");
    console.log("   • 20% of posts have images");
  } catch (error) {
    console.error("❌ Error during data generation:", error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error("❌ Error closing database:", err);
      } else {
        console.log("🔒 Database connection closed");
      }
      process.exit(0);
    });
  }
}

// Execute the data generation
generateAllData();
