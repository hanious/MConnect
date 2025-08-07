// Main Portal Application JavaScript
class PortalApp {
  constructor() {
    this.currentUser = null;
    this.isLoading = false;
    this.headerManager = null;
    this.init();
  }

  init() {
    // Wait for header manager to be available
    this.setupHeaderManager();

    this.loadCurrentUser();
    this.setupEventListeners();
    this.setupScrollAnimations();
    this.setupRippleEffects();
  }

  setupHeaderManager() {
    // Try to get header manager, wait a bit if not available
    if (window.headerManager) {
      this.headerManager = window.headerManager;
    } else {
      // Wait for header manager to load
      setTimeout(() => {
        if (window.headerManager) {
          this.headerManager = window.headerManager;
        }
      }, 100);
    }
  }

  loadCurrentUser() {
    // Delegate to header manager for centralized auth handling
    if (this.headerManager) {
      // Let header manager handle all authentication
      this.headerManager.loadCurrentUser().then(() => {
        this.currentUser = this.headerManager.currentUser;
        if (this.currentUser) {
          this.updateUIForLoggedInUser();
        }
      });
    } else {
      // Fallback: minimal localStorage check only
      try {
        const userData = localStorage.getItem("currentUser");
        if (userData) {
          this.currentUser = JSON.parse(userData);
          this.updateUIForLoggedInUser();
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        localStorage.removeItem("currentUser");
      }
    }
  }

  updateUIForLoggedInUser() {
    if (!this.currentUser) return;

    // Use header manager for consistent user handling
    if (this.headerManager) {
      this.headerManager.currentUser = this.currentUser;
      this.headerManager.updateHeaderDisplay();
    }

    // Setup user menu interactions (notifications functionality)
    this.setupUserMenu();
    // Fetch and update unread notification count badge
    this.fetchUnreadCount();
  }

  setupUserMenu() {
    // Let header manager handle the user menu setup and basic interactions
    if (this.headerManager) {
      this.headerManager.setupNotificationHandlers();
    }

    // Close modal when clicking outside
    document.addEventListener("click", (e) => {
      const userMenu = document.querySelector(".header-user-menu");
      if (userMenu && !userMenu.contains(e.target)) {
        userMenu.classList.remove("header-user-menu--open");
      }

      const notificationModal = document.getElementById("notificationModal");
      if (notificationModal && !notificationModal.contains(e.target)) {
        if (
          notificationModal.style.opacity === "1" &&
          notificationModal.style.visibility === "visible"
        ) {
          notificationModal.style.opacity = "0";
          notificationModal.style.visibility = "hidden";
          this.markNotificationsRead();
        }
      }
    });

    // Close modal on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const userMenu = document.querySelector(".header-user-menu");
        if (userMenu) {
          userMenu.classList.remove("header-user-menu--open");
        }
        const notificationModal = document.getElementById("notificationModal");
        if (notificationModal) {
          notificationModal.style.opacity = "0";
          notificationModal.style.visibility = "hidden";
        }
      }
    });
  }

  getUserInitials() {
    // Use header manager if available for consistent initials
    if (this.headerManager) {
      return this.headerManager.getUserInitials();
    }

    // Fallback to local logic if header manager not available
    if (!this.currentUser) return "AU"; // Default fallback

    // Handle different possible property names for first and last name
    const firstName =
      this.currentUser.firstName || this.currentUser.FirstName || "";
    const lastName =
      this.currentUser.lastName || this.currentUser.LastName || "";

    // Create full name for consistent processing
    const fullName = `${firstName} ${lastName}`.trim();

    if (!fullName || fullName.length === 0) {
      return "AU"; // Default fallback
    }

    const words = fullName.split(" ").filter((word) => word.length > 0);

    if (words.length === 0) {
      return "AU"; // Default fallback
    }

    if (words.length === 1) {
      // Single name - take first two characters or first character twice
      const singleName = words[0].toUpperCase();
      return singleName.length >= 2
        ? singleName.slice(0, 2)
        : singleName + singleName;
    }

    // Multiple words - take first character of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  async fetchNotifications() {
    // Use header manager if available, otherwise fallback to local implementation
    if (this.headerManager && this.headerManager.fetchNotifications) {
      return this.headerManager.fetchNotifications();
    }

    // Fallback implementation
    if (!this.currentUser) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:3000/api/notifications?userId=${this.currentUser.id}`
      );
      if (response.ok) {
        const notifications = await response.json();
        console.log("Fetched notifications:", notifications);
        this.displayNotifications(notifications);
        this.fetchUnreadCount();
      } else {
        console.error("Failed to fetch notifications");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }

  async fetchUnreadCount() {
    // Use header manager if available, otherwise fallback to local implementation
    if (this.headerManager && this.headerManager.fetchUnreadCount) {
      return this.headerManager.fetchUnreadCount();
    }

    // Fallback implementation
    if (!this.currentUser) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:3000/api/notifications/unread-count?userId=${this.currentUser.id}`
      );
      if (response.ok) {
        const data = await response.json();
        const badge = document.getElementById("notificationCountBadge");
        if (badge) {
          if (data.unreadCount > 0) {
            badge.textContent = data.unreadCount;
            badge.style.display = "inline-block";
          } else {
            badge.style.display = "none";
          }
        }
      } else {
        console.error("Failed to fetch unread notification count");
      }
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
    }
  }

  async markNotificationsRead() {
    // Use header manager if available, otherwise fallback to local implementation
    if (this.headerManager && this.headerManager.markNotificationsRead) {
      return this.headerManager.markNotificationsRead();
    }

    // Fallback implementation
    if (!this.currentUser) return;

    try {
      const response = await fetch(
        "http://127.0.0.1:3000/api/notifications/mark-read",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: this.currentUser.id }),
        }
      );

      if (!response.ok) {
        console.error("Failed to mark notifications as read");
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  }

  async displayNotifications(notifications) {
    // Use header manager if available, otherwise fallback to local implementation
    if (this.headerManager && this.headerManager.displayNotifications) {
      return this.headerManager.displayNotifications(notifications);
    }

    // Fallback implementation
    const notificationList = document.getElementById("notificationList");
    if (!notificationList) {
      console.error("Notification list element not found");
      return;
    }

    notificationList.innerHTML = ""; // Clear previous notifications

    // Check if current user is admin
    const isAdmin = await this.checkIfAdmin();
    console.log("Current user is admin:", isAdmin);

    notifications.forEach((notification) => {
      // Create notification item container
      const item = document.createElement("div");
      item.classList.add("notification-item");

      // Main notification content
      let notificationHTML = `
        <div class="notification-content">
          <p>${notification.Message}</p>
          <span class="notification-time">
            ${new Date(notification.DateNotified).toLocaleString()}
          </span>
        </div>
      `;

      // Show action buttons for all notifications if user is admin
      if (isAdmin) {
        console.log("Showing action buttons for admin");
        notificationHTML += `
          <div class="notification-actions">
            <button class="btn btn--success btn--small approve-btn" 
                    data-notification-id="${notification.NotificationID}"
                    data-sender-id="${notification.SenderID}">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn btn--danger btn--small reject-btn" 
                    data-notification-id="${notification.NotificationID}"
                    data-sender-id="${notification.SenderID}">
              <i class="fas fa-times"></i> Reject
            </button>
          </div>
        `;
      }

      item.innerHTML = notificationHTML;
      notificationList.appendChild(item);
    });

    // Setup event handlers for any action buttons
    this.setupNotificationActionHandlers();

    // Show the modal
    const notificationModal = document.getElementById("notificationModal");
    if (notificationModal) {
      notificationModal.style.opacity = "1";
      notificationModal.style.visibility = "visible";
    }
  }

  // Check if current user is admin
  async checkIfAdmin() {
    // Use header manager if available, otherwise fallback to local implementation
    if (this.headerManager && this.headerManager.checkIfAdmin) {
      return this.headerManager.checkIfAdmin();
    }

    // Fallback implementation
    if (!this.currentUser) return false;

    try {
      const response = await fetch(
        "http://127.0.0.1:3000/api/community/community-info"
      );
      if (response.ok) {
        const data = await response.json();
        return data.AdminUserID === this.currentUser.id;
      }
      return false;
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  }

  // Setup handlers for approve/reject buttons
  setupNotificationActionHandlers() {
    // Use header manager if available, otherwise fallback to local implementation
    if (
      this.headerManager &&
      this.headerManager.setupNotificationActionHandlers
    ) {
      return this.headerManager.setupNotificationActionHandlers();
    }

    // Fallback implementation
    const approveButtons = document.querySelectorAll(".approve-btn");
    const rejectButtons = document.querySelectorAll(".reject-btn");

    console.log(`Found ${approveButtons.length} approve buttons`);
    console.log(`Found ${rejectButtons.length} reject buttons`);

    approveButtons.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const notificationId = e.target.dataset.notificationId;
        const senderId = e.target.dataset.senderId;
        console.log(
          "Approve button clicked - NotificationID:",
          notificationId,
          "SenderID:",
          senderId
        );
        await this.handleJoinRequestAction(notificationId, senderId, true);
      });
    });

    rejectButtons.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const notificationId = e.target.dataset.notificationId;
        const senderId = e.target.dataset.senderId;
        console.log(
          "Reject button clicked - NotificationID:",
          notificationId,
          "SenderID:",
          senderId
        );
        await this.handleJoinRequestAction(notificationId, senderId, false);
      });
    });
  }

  async handleJoinRequestAction(notificationId, senderId, approve) {
    // Use header manager if available, otherwise fallback to local implementation
    if (this.headerManager && this.headerManager.handleJoinRequestAction) {
      return this.headerManager.handleJoinRequestAction(
        notificationId,
        senderId,
        approve
      );
    }

    // Fallback implementation
    try {
      const response = await fetch(
        "http://127.0.0.1:3000/api/notifications/process-join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notificationId,
            userId: senderId,
            approve,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process request");
      }

      const data = await response.json();
      await this.fetchNotifications();

      if (this.currentUser?.id === senderId) {
        await this.loadCurrentUser();
      }

      this.showNotification(
        data.message ||
          (approve ? "Request approved successfully" : "Request rejected"),
        "success"
      );

      return data;
    } catch (error) {
      console.error("Error processing join request:", error);
      this.showNotification(`Error: ${error.message}`, "error");
      throw error;
    }
  }

  async fetchCommunityMembers() {
    if (!this.currentUser) return;

    try {
      const response = await fetch(
        "http://127.0.0.1:3000/api/community/joined-members"
      );
      if (response.ok) {
        const members = await response.json();
        console.log("Fetched community members:", members);
        return members;
      } else {
        throw new Error("Failed to fetch community members");
      }
    } catch (error) {
      console.error("Error fetching community members:", error);
      throw error;
    }
  }

  showNotification(message, type = "success") {
    console.log(`${type.toUpperCase()}: ${message}`);
    alert(`${type.toUpperCase()}: ${message}`);
  }

  setupEventListeners() {
    // Listen for authentication updates from header manager
    document.addEventListener("userDataUpdated", () => {
      if (this.headerManager) {
        this.currentUser = this.headerManager.currentUser;
        if (this.currentUser) {
          this.updateUIForLoggedInUser();
        }
      }
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    });

    // Header scroll effect
    let lastScrollTop = 0;
    const header = document.querySelector(".header");

    window.addEventListener("scroll", () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > lastScrollTop && scrollTop > 100) {
        header.style.transform = "translateY(-100%)";
      } else {
        header.style.transform = "translateY(0)";
      }

      lastScrollTop = scrollTop;
    });
  }

  setupScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate");
        }
      });
    }, observerOptions);

    // Observe all elements with animate-on-scroll class
    document.querySelectorAll(".animate-on-scroll").forEach((el) => {
      observer.observe(el);
    });
  }

  setupRippleEffects() {
    document.querySelectorAll(".btn").forEach((button) => {
      button.addEventListener("click", function (e) {
        const ripple = document.createElement("span");
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + "px";
        ripple.style.left = x + "px";
        ripple.style.top = y + "px";
        ripple.classList.add("ripple");

        this.appendChild(ripple);

        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.portalApp = new PortalApp();

  // Wait for header component to load before updating UI
  const headerPlaceholder = document.getElementById("header-placeholder");
  if (headerPlaceholder) {
    const observer = new MutationObserver((mutations, obs) => {
      if (headerPlaceholder.innerHTML.trim().length > 0) {
        if (window.portalApp) {
          window.portalApp.updateUIForLoggedInUser();
        }
        obs.disconnect();
      }
    });
    observer.observe(headerPlaceholder, { childList: true });
  } else {
    // If no header placeholder, update UI immediately
    if (window.portalApp) {
      window.portalApp.updateUIForLoggedInUser();
    }
  }

  // Handle Google auth redirect
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("googleAuthSuccess")) {
    try {
      // Clear logout flag since user is logging in
      sessionStorage.removeItem("userLoggedOut");

      const userData = urlParams.get("user");
      if (userData) {
        const user = JSON.parse(decodeURIComponent(userData));
        console.log("Received user data from Google OAuth:", user);

        // Ensure required fields
        if (!user.FirstName) user.FirstName = "Google";
        if (!user.LastName) user.LastName = "User";
        if (!user.Email) user.Email = "No email provided";

        localStorage.setItem("currentUser", JSON.stringify(user));
        console.log("Stored user in localStorage:", user);

        if (window.portalApp) {
          window.portalApp.currentUser = user;
          window.portalApp.updateUIForLoggedInUser();
        }

        // Clean URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    } catch (e) {
      console.error("Error processing Google auth:", e);
    }
  }

  // Let header manager handle all authentication loading
  // No need for duplicate loadUser() logic here
});

// Global functions (from second file)
function showUserMenu(user) {
  const userMenu = document.getElementById("userMenu");
  if (!userMenu) return;
  userMenu.innerHTML = `
    <div class="user-menu__avatar">${
      user.FirstName ? user.FirstName[0] : "U"
    }</div>
    <span class="user-menu__name">${user.FirstName || ""} ${
    user.LastName || ""
  }</span>
    <button class="user-menu__logout" onclick="logout()">Logout</button>
  `;
}

function showGuestMenu() {
  const userMenu = document.getElementById("userMenu");
  if (!userMenu) return;
  userMenu.innerHTML = "";
}

// Enhanced logout function - use HeaderManager if available
function logout() {
  // Set logout flag to prevent automatic re-authentication
  sessionStorage.setItem("userLoggedOut", "true");

  // Use header manager logout if available (recommended)
  if (window.headerManager && window.headerManager.handleLogout) {
    return window.headerManager.handleLogout();
  }

  // Fallback implementation (only if header manager not available)
  console.warn("Header manager not available, using fallback logout");
  localStorage.removeItem("currentUser");
  sessionStorage.clear();
  sessionStorage.setItem("userLoggedOut", "true"); // Re-set after clear
  window.location.href = "login.html";
}
