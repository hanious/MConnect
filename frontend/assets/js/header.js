class HeaderManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  async init() {
    await this.loadCurrentUser();
    // Don't call updateHeaderDisplay immediately - wait for header to load
    this.setupEventListeners();
    this.handleGoogleAuthRedirect();
  }

  // Enhanced user loading with session check for Google OAuth
  async loadCurrentUser() {
    try {
      // Check if user explicitly logged out (prevent automatic re-authentication)
      const userLoggedOut = sessionStorage.getItem("userLoggedOut");
      if (userLoggedOut === "true") {
        console.log("User previously logged out, not restoring session");
        this.currentUser = null;
        return;
      }

      // Try localStorage first
      const userData = localStorage.getItem("currentUser");
      if (userData) {
        this.currentUser = JSON.parse(userData);
        return;
      }

      // Check backend session (for Google auth) only if user hasn't explicitly logged out
      const response = await fetch(
        "http://localhost:3000/api/auth/current-user",
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          // Normalize the user data format
          const normalizedUser = {
            id: data.user.UserID || data.user.id,
            firstName: data.user.FirstName || data.user.firstName || "Google",
            lastName: data.user.LastName || data.user.lastName || "User",
            email: data.user.Email || data.user.email || "No email provided",
            CommunityID: data.user.CommunityID || null,
          };

          // Store in localStorage for consistency
          localStorage.setItem("currentUser", JSON.stringify(normalizedUser));
          this.currentUser = normalizedUser;
          return;
        }
      }

      // No user found
      this.currentUser = null;
    } catch (error) {
      console.error("Error loading current user:", error);
      this.currentUser = null;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentUserId() {
    return this.currentUser
      ? this.currentUser.id || this.currentUser.UserID
      : null;
  }

  getCurrentUserName() {
    if (!this.currentUser) return null;

    const firstName =
      this.currentUser.firstName || this.currentUser.FirstName || "";
    const lastName =
      this.currentUser.lastName || this.currentUser.LastName || "";

    return `${firstName} ${lastName}`.trim() || "User";
  }

  getUserInitials(name = null) {
    // If no name provided, use current user's name
    const userName = name || this.getCurrentUserName();

    if (!userName || typeof userName !== "string") {
      return "U";
    }

    const words = userName
      .trim()
      .split(" ")
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      return "U";
    }

    if (words.length === 1) {
      // Single word - take first two characters
      return words[0].substring(0, 2).toUpperCase();
    }

    // Multiple words - take first character of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  updateHeaderDisplay() {
    this.updateHeaderAvatar();
    this.updateUserMenu();
    this.toggleAuthButtons();
  }

  toggleAuthButtons() {
    const signInBtn = document.querySelector(".header-signin-btn");
    const joinBtn = document.querySelector(".header-join-btn");
    const userMenu = document.querySelector(".header-user-menu");

    if (this.currentUser) {
      // User is logged in - hide auth buttons
      if (signInBtn) signInBtn.style.display = "none";
      if (joinBtn) joinBtn.style.display = "none";

      // Show user menu if it exists
      if (userMenu) userMenu.style.display = "block";
    } else {
      // User is not logged in - show auth buttons
      if (signInBtn) signInBtn.style.display = "inline-flex";
      if (joinBtn) joinBtn.style.display = "inline-flex";

      // Hide user menu if it exists
      if (userMenu) userMenu.style.display = "none";
    }
  }

  updateHeaderAvatar() {
    const headerAvatar = document.querySelector(".header-avatar");
    const avatarElements = document.querySelectorAll(
      ".avatar-text, .header-avatar .avatar, .header-avatar__initials"
    );

    if (!this.currentUser) return;

    const initials = this.getUserInitials();

    // Update all avatar elements
    avatarElements.forEach((element) => {
      element.textContent = initials;
    });

    // Specifically update header avatar if it exists
    if (headerAvatar) {
      const avatarText =
        headerAvatar.querySelector(".avatar-text") ||
        headerAvatar.querySelector(".avatar") ||
        headerAvatar.querySelector(".header-avatar__initials");
      if (avatarText) {
        avatarText.textContent = initials;
      }
    }
  }

  updateUserMenu() {
    const headerActions = document.querySelector(".header__actions");
    if (!headerActions) {
      return;
    }

    if (!this.currentUser) {
      // Remove existing user menu if no user
      const existingUserMenu = headerActions.querySelector(".header-user-menu");
      if (existingUserMenu) {
        existingUserMenu.remove();
      }
      return;
    }

    const userName = this.getCurrentUserName();
    const email =
      this.currentUser.email || this.currentUser.Email || "No email provided";
    const initials = this.getUserInitials();

    // Remove existing user menu first
    const existingUserMenu = headerActions.querySelector(".header-user-menu");
    if (existingUserMenu) {
      existingUserMenu.remove();
    }

    // Create complete user menu HTML
    const userMenuHTML = `
    <div class="header-user-menu" style="display: block;">
      <div class="header-user-menu__trigger" style="cursor: pointer;">
        <div class="header-avatar">
          <span class="header-avatar__initials">${initials}</span>
        </div>
        <div class="header-user-info">
          <span class="header-user-name">${userName}</span>
          <span class="header-user-email">${email}</span>
        </div>
        <i class="fas fa-chevron-down header-user-menu__arrow"></i>
      </div>
        <div class="header-user-menu__dropdown">
          <div class="header-user-menu__header">
            <div class="header-avatar header-avatar--large">
              <span class="header-avatar__initials">${initials}</span>
            </div>
            <div class="header-user-info">
              <div class="header-user-name">${userName}</div>
              <div class="header-user-email">${email}</div>
            </div>
          </div>
          <div class="header-user-menu__divider"></div>
          <div class="header-user-menu__items">
            <button type="button" class="header-user-menu__item" id="notificationBtn">
              <i class="fas fa-bell"></i>
              <span>Notifications</span>
              <span id="notificationCountBadge" class="notification-count-badge" style="display:none;">0</span>
            </button>
            <a href="community.html" class="header-user-menu__item">
              <i class="fas fa-users"></i>
              <span>Communities</span>
            </a>
            <a href="profile.html" class="header-user-menu__item">
              <i class="fas fa-user"></i>
              <span>Profile</span>
            </a>
            <a href="#" class="header-user-menu__item">
              <i class="fas fa-cog"></i>
              <span>Settings</span>
            </a>
          </div>
          <div class="header-user-menu__divider"></div>
          <button class="header-user-menu__item header-user-menu__logout" onclick="window.headerManager.handleLogout()">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </button>
        </div>
      </div>
    `;

    // Add user menu to header actions
    headerActions.insertAdjacentHTML("beforeend", userMenuHTML);

    // Setup interactions immediately
    this.setupUserMenuInteractions();
    this.setupNotificationHandlers();

    // Update traditional user menu elements (for backward compatibility)
    const userNameElement = document.getElementById("userName");
    const userEmailElement = document.getElementById("userEmail");

    if (userNameElement) {
      userNameElement.textContent = userName;
    }

    if (userEmailElement) {
      userEmailElement.textContent = email;
    }
  }

  setupUserMenuInteractions() {
    const userMenuTrigger = document.querySelector(
      ".header-user-menu__trigger"
    );
    const userMenuDropdown = document.querySelector(
      ".header-user-menu__dropdown"
    );
    const userMenu = document.querySelector(".header-user-menu");

    if (userMenuTrigger && userMenuDropdown && userMenu) {
      // Remove any existing event listeners first
      userMenuTrigger.removeEventListener("click", this.handleUserMenuClick);

      // Add click handler to trigger
      this.handleUserMenuClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Toggle the open class on the parent user menu element
        userMenu.classList.toggle("header-user-menu--open");
      };

      userMenuTrigger.addEventListener("click", this.handleUserMenuClick);

      // Close dropdown when clicking outside
      this.handleOutsideClick = (e) => {
        if (
          !userMenuTrigger.contains(e.target) &&
          !userMenuDropdown.contains(e.target)
        ) {
          userMenu.classList.remove("header-user-menu--open");
        }
      };

      document.addEventListener("click", this.handleOutsideClick);

      // Prevent dropdown from closing when clicking inside it
      userMenuDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    } else {
      console.error("User menu elements not found:", {
        userMenuTrigger,
        userMenuDropdown,
        userMenu,
      });
    }
  }

  setupNotificationHandlers() {
    const notificationBtn = document.getElementById("notificationBtn");
    const closeNotificationModal = document.getElementById(
      "closeNotificationModal"
    );

    if (notificationBtn) {
      notificationBtn.addEventListener("click", (e) => {
        console.log("Notification button clicked");
        e.preventDefault();
        e.stopPropagation();

        // Close user menu dropdown
        const userMenu = document.querySelector(".header-user-menu");
        if (userMenu) {
          userMenu.classList.remove("header-user-menu--open");
        }

        this.fetchNotifications();
        console.log("Notification modal should be shown now");
      });
    }

    if (closeNotificationModal) {
      closeNotificationModal.addEventListener("click", () => {
        const notificationModal = document.getElementById("notificationModal");
        if (notificationModal) {
          notificationModal.classList.remove("show");
          notificationModal.style.opacity = "0";
          notificationModal.style.visibility = "hidden";
          this.markNotificationsRead();
        }
      });
    }

    // Fetch initial unread count
    this.fetchUnreadCount();
  }

  async fetchNotifications() {
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

  async checkIfAdmin() {
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

  setupNotificationActionHandlers() {
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

  showNotificationMessage(message, type = "success") {
    console.log(`${type.toUpperCase()}: ${message}`);

    // Try to use a more sophisticated notification system if available
    if (window.communityManager && window.communityManager.showNotification) {
      window.communityManager.showNotification(message, type);
    } else {
      // Fallback to alert for now
      alert(`${type.toUpperCase()}: ${message}`);
    }
  }

  setupEventListeners() {
    // Listen for user data changes in localStorage
    window.addEventListener("storage", async (e) => {
      if (e.key === "currentUser") {
        await this.loadCurrentUser();
        this.updateHeaderDisplay();
      }
    });

    // Listen for custom events when user data is updated
    document.addEventListener("userDataUpdated", async () => {
      await this.loadCurrentUser();
      this.updateHeaderDisplay();
    });

    // User menu logout handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleLogout();
      });
    }
  }

  // Handle Google OAuth redirect
  handleGoogleAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("googleAuthSuccess")) {
      try {
        // Clear logout flag since user is logging in
        sessionStorage.removeItem("userLoggedOut");

        const userData = urlParams.get("user");
        if (userData) {
          const user = JSON.parse(decodeURIComponent(userData));

          // Normalize the user data format to match what HeaderManager expects
          const normalizedUser = {
            id: user.id || user.UserID,
            firstName: user.firstName || user.FirstName || "Google",
            lastName: user.lastName || user.LastName || "User",
            email: user.email || user.Email || "No email provided",
            CommunityID: user.CommunityID || null,
          };

          // Store in localStorage
          localStorage.setItem("currentUser", JSON.stringify(normalizedUser));

          // Mark as Google authentication for logout handling
          sessionStorage.setItem("googleAuth", "true");

          // Update current user and refresh display
          this.currentUser = normalizedUser;
          this.waitForHeaderAndUpdate();

          // Clean URL to remove the auth parameters
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
  }

  toggleUserMenu() {
    const userMenu = document.querySelector(".header-user-menu");
    if (userMenu) {
      userMenu.classList.toggle("header-user-menu--open");
    }
  }

  async handleLogout() {
    try {
      // Check if it's a Google user BEFORE clearing anything
      const isGoogleUser = this.isGoogleUser();
      console.log("Logging out, isGoogleUser:", isGoogleUser);

      // Set logout flag to prevent automatic re-authentication
      sessionStorage.setItem("userLoggedOut", "true");

      // Clear local storage and session storage immediately
      localStorage.removeItem("currentUser");
      localStorage.removeItem("sessionData");
      sessionStorage.removeItem("googleAuth");

      // Clear any other potential auth-related storage
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("authToken");
      localStorage.removeItem("googleUser");

      // Update the UI immediately
      this.currentUser = null;
      this.updateHeaderDisplay();

      // Create promises for both logout calls
      const logoutPromises = [];

      // Regular logout call
      const regularLogoutPromise = fetch(
        "http://localhost:3000/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      ).catch((error) => {
        console.warn("Regular logout failed:", error);
        return { ok: false };
      });

      logoutPromises.push(regularLogoutPromise);

      // For Google OAuth, we need to also revoke the Google session
      if (isGoogleUser) {
        console.log("Calling Google logout endpoint");
        const googleLogoutPromise = fetch(
          "http://localhost:3000/api/auth/google/logout",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }
        ).catch((error) => {
          console.warn("Google logout failed:", error);
          return { ok: false };
        });

        logoutPromises.push(googleLogoutPromise);
      }

      // Wait for all logout calls to complete (or fail)
      const results = await Promise.all(logoutPromises);
      console.log("Logout results:", results);

      // If any logout calls failed, make a final cleanup call
      const allSuccessful = results.every((result) => result.ok);
      if (!allSuccessful) {
        console.log("Some logout calls failed, performing force cleanup...");
        try {
          await fetch("http://localhost:3000/api/auth/cleanup-session", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });
          console.log("Force cleanup completed");
        } catch (cleanupError) {
          console.warn("Force cleanup failed:", cleanupError);
        }
      }

      // Verify session is actually cleared
      try {
        const verifyResponse = await fetch(
          "http://localhost:3000/api/auth/verify-session",
          {
            method: "GET",
            credentials: "include",
          }
        );
        if (verifyResponse.ok) {
          const sessionInfo = await verifyResponse.json();
          console.log("Session verification after logout:", sessionInfo);

          // If session is still active, try one more force cleanup
          if (sessionInfo.isAuthenticated || sessionInfo.hasUser) {
            console.warn(
              "Session still active after logout, performing final cleanup..."
            );
            await fetch("http://localhost:3000/api/auth/cleanup-session", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
            });

            // If still persisting, use nuclear option
            console.warn("Using nuclear option - clearing all sessions...");
            await fetch("http://localhost:3000/api/auth/clear-all-sessions", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
            });

            // Verify again after nuclear cleanup
            const finalVerify = await fetch(
              "http://localhost:3000/api/auth/verify-session",
              {
                method: "GET",
                credentials: "include",
              }
            );
            if (finalVerify.ok) {
              const finalSessionInfo = await finalVerify.json();
              console.log(
                "Final session verification after nuclear cleanup:",
                finalSessionInfo
              );
            }
          }
        }
      } catch (verifyError) {
        console.warn("Session verification failed:", verifyError);
      }

      // Even if some logout calls fail, we've already cleared local data
      console.log("All logout operations completed, redirecting...");

      // Force a page reload to clear any remaining state
      window.location.replace("/frontend/pages/login.html");
    } catch (error) {
      console.error("Logout error:", error);
      // Even on error, clear all local data and redirect
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/frontend/pages/login.html");
    }
  }

  // Helper method to check if current user is from Google OAuth
  isGoogleUser() {
    if (!this.currentUser) return false;

    // Check if user has Google-specific indicators
    const hasGoogleEmail =
      this.currentUser.email && this.currentUser.email.includes("@");
    const hasDefaultGoogleName =
      this.currentUser.firstName === "Google" &&
      this.currentUser.lastName === "User";
    const fromGoogleAuth = sessionStorage.getItem("googleAuth") === "true";

    return hasDefaultGoogleName || fromGoogleAuth;
  }

  async refreshUserData() {
    await this.loadCurrentUser();

    // Wait for header to be loaded before updating display
    this.waitForHeaderAndUpdate();

    // Dispatch custom event for other components to listen
    document.dispatchEvent(new CustomEvent("userDataUpdated"));
  }

  // Wait for header elements to be available and then update display
  waitForHeaderAndUpdate() {
    const checkHeader = () => {
      const headerActions = document.querySelector(".header__actions");
      if (headerActions) {
        this.updateHeaderDisplay();
      } else {
        setTimeout(checkHeader, 100);
      }
    };
    checkHeader();
  }

  // Utility method to check if current user owns a post/comment
  isCurrentUserContent(authorName, userId = null) {
    if (!this.currentUser) return false;

    const currentUserName = this.getCurrentUserName();
    const currentUserId = this.getCurrentUserId();

    // Check by name
    if (authorName === currentUserName || authorName === "You") {
      return true;
    }

    // Check by user ID if provided
    if (userId && currentUserId && userId === currentUserId) {
      return true;
    }

    return false;
  }

  // Method to format user avatar for display
  createAvatarElement(userName = null, additionalClasses = "") {
    const initials = this.getUserInitials(userName);
    return `<div class="avatar ${additionalClasses}">${initials}</div>`;
  }

  // Method to get current user's avatar HTML
  getCurrentUserAvatar(additionalClasses = "") {
    return this.createAvatarElement(null, additionalClasses);
  }

  // Test method to simulate a logged-in user
  testUserMenu() {
    this.currentUser = {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      id: 1,
    };
    localStorage.setItem("currentUser", JSON.stringify(this.currentUser));

    // Use waitForHeaderAndUpdate to ensure header is loaded
    this.waitForHeaderAndUpdate();
  }
}

// Create global instance
const headerManager = new HeaderManager();

// Export for use in other modules
window.HeaderManager = HeaderManager;
window.headerManager = headerManager;

// Export specific functions for backwards compatibility
window.getUserInitials = (name) => headerManager.getUserInitials(name);
window.getCurrentUser = () => headerManager.getCurrentUser();
window.getCurrentUserId = () => headerManager.getCurrentUserId();
window.getCurrentUserName = () => headerManager.getCurrentUserName();
window.isCurrentUserContent = (authorName, userId) =>
  headerManager.isCurrentUserContent(authorName, userId);

// Make test function globally available for debugging
window.testUserMenu = () => headerManager.testUserMenu();
