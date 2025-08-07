class CommunityManager {
  constructor() {
    this.posts = [];
    this.comments = {};
    this.members = []; // Store community members
    this.currentPostId = null;
    this.currentEditingComment = null;
    this.searchResults = [];
    this.isSearching = false;
    this.currentQuery = "";
    this.headerManager = window.headerManager; // Import header manager
    this.init();
  }

  init() {
    this.setupHeaderManager();
    this.setupEventListeners();
    this.showPostsLoading(); // Show loading display immediately
    this.loadPostsFromDatabase(); // Load posts from database on initialization
    this.loadMembersFromDatabase(); // Load community members
    this.updateFormAvatars(); // Update form avatars with current user
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
          this.updateFormAvatars(); // Update form avatars once header manager is available
        }
      }, 100);
    }
  }

  async refreshPosts() {
    await this.loadPostsFromDatabase();
  }

  async loadPostsFromDatabase() {
    // Show loading display
    this.showPostsLoading();

    try {
      const response = await fetch("http://localhost:3000/api/posts", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load posts");
      }

      const posts = await response.json();

      // Clear existing posts array
      this.posts = [];

      // Get current user for like status checking
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "null"
      );
      const currentUserId = currentUser
        ? currentUser.id || currentUser.UserID
        : null;

      // Show skeleton loading while processing posts
      this.showPostsSkeleton(posts.length);

      // Format posts and add them directly to array
      for (const post of posts) {
        const formattedPost = {
          id: post.PostID,
          author: `${post.FirstName} ${post.LastName}`,
          role: post.JobTitle,
          time: this.formatDate(post.DatePosted),
          content: post.Content,
          image: post.ImageURL,
          likes: 0,
          comments: 0,
          shares: 0,
          isLiked: post.IsLikedByUser === 1 && currentUserId ? true : false,
          userId: post.UserID, // Add user ID for ownership checking
        }; // Push to array
        this.posts.push(formattedPost);
        this.comments[formattedPost.id] = [];

        // Load like count and user's like status for this post
        try {
          const likeResponse = await fetch(
            `http://localhost:3000/api/likes/post/${post.PostID}`,
            {
              method: "GET",
              credentials: "include",
            }
          );

          if (likeResponse.ok) {
            const likeData = await likeResponse.json();
            formattedPost.likes = likeData.totalLikes;

            // Check if current user has liked this post
            if (currentUserId && likeData.likes) {
              formattedPost.isLiked = likeData.likes.some(
                (like) =>
                  like.UserID === currentUserId ||
                  like.UserID === currentUser.id ||
                  like.UserID === currentUser.UserID
              );
            }
          }
        } catch (likeError) {
          console.error(
            "Error loading likes for post:",
            post.PostID,
            likeError
          );
        }

        // Load like count and user's like status for this post
        try {
          const commentResponse = await fetch(
            `http://localhost:3000/api/comments/post/${post.PostID}`,
            {
              method: "GET",
              credentials: "include",
            }
          );

          if (commentResponse.ok) {
            const comments = await commentResponse.json();
            formattedPost.comments = comments.length;
          }
        } catch (commentError) {}
      }

      // Render all posts at once and hide loading
      this.renderPosts();
      this.hidePostsLoading();
    } catch (error) {
      console.error("Failed to load posts:", error);
      this.showPostsError();
      this.showNotification("Failed to load posts from database", "error");
    }
  }

  async loadMembersFromDatabase() {
    try {
      const response = await fetch(
        "http://localhost:3000/api/community/joined-members",
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load members");
      }

      const users = await response.json();

      // Format members data
      this.members = users.map((user) => ({
        id: user.UserID,
        name: `${user.FirstName} ${user.LastName}`,
        role: user.JobTitle,
        avatar: this.headerManager
          ? this.headerManager.getUserInitials(
              `${user.FirstName} ${user.LastName}`
            )
          : this.getInitials(`${user.FirstName} ${user.LastName}`),
        company: user.Company || "",
        industry: user.Industry || "",
        dateJoined: user.DateJoined,
      }));

      this.renderMembersSidebar();
    } catch (error) {
      console.error("Failed to load members:", error);
      this.showNotification("Failed to load community members", "error");
      // Initialize empty members array
      this.members = [];
      this.renderMembersSidebar();
    }
  }

  renderMembersSidebar() {
    const membersList = document.getElementById("membersList");
    const membersCount = document.getElementById("membersCountSidebar");

    if (!membersList || !membersCount) return;

    // Update members count
    membersCount.textContent = this.members.length;

    // Sort members alphabetically by name
    const sortedMembers = [...this.members].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    // Render members list
    membersList.innerHTML = sortedMembers
      .map(
        (member) => `
      <div class="member-item" data-user-id="${member.id}">
        <div class="member-avatar">${member.avatar}</div>
        <div class="member-info">
          <div class="member-name">${member.name}</div>
          <div class="member-role">${member.role}</div>
        </div>
      </div>
    `
      )
      .join("");

    // Add click listeners for member items
    membersList.querySelectorAll(".member-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const userId = Number.parseInt(e.currentTarget.dataset.userId);
        this.searchUserPosts(userId);
      });
    });
  }

  // Check if user is logged in
  isUserLoggedIn() {
    const currentUser = JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );
    return currentUser !== null;
  }

  isUserInCommunity() {
    const currentUser = JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );
    if (!currentUser) {
      return false;
    }
    return currentUser.CommunityID === 1; // Assuming community ID is 1
  }

  // Helper method to check authentication and return appropriate message
  checkUserAccess(action = "perform this action") {
    if (!this.isUserLoggedIn()) {
      return {
        allowed: false,
        message: `Please log in to ${action}`,
        type: "login_required",
      };
    }

    if (!this.isUserInCommunity()) {
      return {
        allowed: false,
        message: `You must join the community to ${action}. Click 'Join Community' to request access.`,
        type: "community_required",
      };
    }

    return { allowed: true };
  }

  searchUserPosts(userId) {
    const member = this.members.find((m) => m.id === userId);
    if (!member) return;

    // Filter posts by this user
    const userPosts = this.posts.filter((post) =>
      post.author.toLowerCase().includes(member.name.toLowerCase())
    );

    if (userPosts.length > 0) {
      this.showNotification(
        `Found ${userPosts.length} posts by ${member.name}`,
        "info"
      );
      // Highlight user posts in the feed
      this.highlightUserPosts(userId, member.name);
    } else {
      this.showNotification(`No posts found by ${member.name}`, "info");
    }
  }

  highlightUserPosts(userId, userName) {
    // Use the existing search functionality to filter posts by username
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.value = userName; // Use full name for search
      this.performSearch();
    }
  }

  updatePostButtonState(submitBtn) {
    const accessCheck = this.checkUserAccess("post");
    if (!accessCheck.allowed) {
      submitBtn.style.opacity = "0.6";
      submitBtn.style.cursor = "not-allowed";
      submitBtn.title = accessCheck.message;
    }
  }

  updateCommentButtonState(submitBtn) {
    const accessCheck = this.checkUserAccess("comment");
    if (!accessCheck.allowed) {
      submitBtn.style.opacity = "0.6";
      submitBtn.style.cursor = "not-allowed";
      submitBtn.title = accessCheck.message;
    }
  }

  setupEventListeners() {
    // Submit post
    const submitBtn = document.getElementById("submitPost");
    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Additional check before submission with improved access check
        const accessCheck = this.checkUserAccess("post");
        if (!accessCheck.allowed) {
          this.showNotification(accessCheck.message, "warning", 5000);

          // Only highlight join button if user is logged in but not in community
          if (accessCheck.type === "community_required") {
            const joinBtn = document.getElementById("joinCommunityBtn");
            if (joinBtn && joinBtn.style.display !== "none") {
              joinBtn.style.animation = "pulse 1s ease-in-out 3 alternate";
              setTimeout(() => {
                joinBtn.style.animation = "";
              }, 3000);
            }
          }
          return;
        }

        this.submitPost();
      });

      // Update button state based on community membership
      this.updatePostButtonState(submitBtn);
    }

    // Attach image
    const attachImageBtn = document.getElementById("attachImageBtn");
    const imageInput = document.getElementById("imageInput");
    if (attachImageBtn && imageInput) {
      attachImageBtn.addEventListener("click", () => imageInput.click());
      imageInput.addEventListener("change", (e) => this.handleImageUpload(e));
    }

    // Remove image
    const removeImageBtn = document.getElementById("removeImage");
    if (removeImageBtn) {
      removeImageBtn.addEventListener("click", () => this.removeImage());
    }

    // Auto-resize postContent
    const postContent = document.getElementById("postContent");
    if (postContent) {
      postContent.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
      });

      // Add focus handler to check community membership
      postContent.addEventListener("focus", () => {
        const accessCheck = this.checkUserAccess("post");
        if (!accessCheck.allowed) {
          this.showNotification(accessCheck.message, "warning", 3000);
          postContent.blur(); // Remove focus

          // Only highlight join button if user is logged in but not in community
          if (accessCheck.type === "community_required") {
            const joinBtn = document.getElementById("joinCommunityBtn");
            if (joinBtn && joinBtn.style.display !== "none") {
              joinBtn.style.animation = "pulse 1s ease-in-out 2 alternate";
              setTimeout(() => {
                joinBtn.style.animation = "";
              }, 2000);
            }
          }
        }
      });

      // Handle Enter key in post textarea
      postContent.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();

          // Check user access before submitting
          const accessCheck = this.checkUserAccess("post");
          if (!accessCheck.allowed) {
            this.showNotification(accessCheck.message, "warning", 3000);
            return;
          }

          this.submitPost();
        }
      });
    }

    // Post actions (like, comment, share)
    document.addEventListener("click", (e) => {
      if (e.target.closest(".post__action")) {
        e.preventDefault();
        e.stopPropagation();

        const action = e.target.closest(".post__action");
        const postId = Number.parseInt(action.closest(".post").dataset.postId);

        if (
          action.textContent.includes("Like") ||
          action.querySelector("i").classList.contains("fa-thumbs-up")
        ) {
          this.toggleLike(postId, action);
        } else if (action.textContent.includes("Comment")) {
          this.showComments(postId);
        } else if (action.textContent.includes("Share")) {
          this.sharePost(postId);
        }
      }

      // Post menu actions
      if (e.target.closest(".post__delete")) {
        e.preventDefault();
        e.stopPropagation();

        const postElement = e.target.closest(".post");
        const postIdStr = postElement.dataset.postId;

        if (!postIdStr) {
          this.showNotification("Error: Could not find post ID", "error");
          return false;
        }

        const postId = Number.parseInt(postIdStr);

        if (isNaN(postId)) {
          this.showNotification("Error: Invalid post ID", "error");
          return false;
        }

        // Close the dropdown menu
        document
          .querySelectorAll(".post__dropdown.show")
          .forEach((dropdown) => {
            dropdown.classList.remove("show");
          });

        this.deletePost(postId);
        return false;
      }

      if (e.target.closest(".post__edit")) {
        const postElement = e.target.closest(".post");
        const postId = Number.parseInt(postElement.dataset.postId);
        this.editPost(postId);
      }

      // Comment actions
      if (e.target.closest(".comment__like")) {
        const commentElement = e.target.closest(".comment");
        const commentId = Number.parseInt(commentElement.dataset.commentId);
        const actionElement = e.target.closest(".comment__like");
        this.toggleCommentLike(commentId, actionElement);
      }

      if (e.target.closest(".comment__edit")) {
        const commentId = Number.parseInt(
          e.target.closest(".comment").dataset.commentId
        );
        this.editComment(commentId);
      }

      if (e.target.closest(".comment__delete")) {
        const commentId = Number.parseInt(
          e.target.closest(".comment").dataset.commentId
        );
        this.deleteComment(commentId);
      }

      // Edit form actions
      if (e.target.classList.contains("edit-save")) {
        this.saveCommentEdit(e.target);
      }

      if (e.target.classList.contains("edit-cancel")) {
        this.cancelCommentEdit(e.target);
      }

      // Close post dropdown when clicking outside
      if (!e.target.closest(".post__menu")) {
        document
          .querySelectorAll(".post__dropdown.show")
          .forEach((dropdown) => {
            dropdown.classList.remove("show");
          });
      }

      // Handle retry button click
      if (e.target.closest("#retryLoadPosts")) {
        e.preventDefault();
        e.stopPropagation();
        this.loadPostsFromDatabase();
      }
    });

    // Setup modal events
    this.setupModal();
  }

  setupModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    const closeModal = document.getElementById("closeModal");
    const submitComment = document.getElementById("submitComment");

    // Close modal events
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
          this.closeModal();
        }
      });
    }
    if (closeModal) {
      closeModal.addEventListener("click", () => this.closeModal());
    }

    // Submit comment
    if (submitComment) {
      submitComment.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Additional check before submission with improved access check
        const accessCheck = this.checkUserAccess("comment");
        if (!accessCheck.allowed) {
          this.showNotification(accessCheck.message, "warning", 5000);

          // Close modal for any access denial
          this.closeModal();

          // Only highlight join button if user is logged in but not in community
          if (accessCheck.type === "community_required") {
            const joinBtn = document.getElementById("joinCommunityBtn");
            if (joinBtn && joinBtn.style.display !== "none") {
              joinBtn.style.animation = "pulse 1s ease-in-out 3 alternate";
              setTimeout(() => {
                joinBtn.style.animation = "";
              }, 3000);
            }
          }
          return;
        }

        this.submitComment();
      });
    }

    // Close modal on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal();
      }
    });

    // Auto-resize comment textarea
    const commentContent = document.getElementById("commentContent");
    if (commentContent) {
      commentContent.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
      });

      // Add focus handler to check community membership
      commentContent.addEventListener("focus", () => {
        const accessCheck = this.checkUserAccess("comment");
        if (!accessCheck.allowed) {
          this.showNotification(accessCheck.message, "warning", 3000);
          commentContent.blur(); // Remove focus

          // Close modal for any access denial
          this.closeModal();

          // Only highlight join button if user is logged in but not in community
          if (accessCheck.type === "community_required") {
            const joinBtn = document.getElementById("joinCommunityBtn");
            if (joinBtn && joinBtn.style.display !== "none") {
              joinBtn.style.animation = "pulse 1s ease-in-out 2 alternate";
              setTimeout(() => {
                joinBtn.style.animation = "";
              }, 2000);
            }
          }
        }
      });

      // Handle Enter key in comment textarea
      commentContent.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();

          // Check user access before submitting
          const accessCheck = this.checkUserAccess("comment");
          if (!accessCheck.allowed) {
            this.showNotification(accessCheck.message, "warning", 3000);
            this.closeModal();
            return;
          }

          this.submitComment();
        }
      });
    }

    // Search functionality event listeners
    this.setupSearchEventListeners();
  }

  setupSearchEventListeners() {
    // Search button click
    document.addEventListener("click", (e) => {
      if (e.target.id === "searchBtn" || e.target.closest("#searchBtn")) {
        e.preventDefault();
        this.performSearch();
      }

      if (e.target.id === "clearSearch" || e.target.closest("#clearSearch")) {
        e.preventDefault();
        this.clearSearch();
      }

      if (e.target.id === "closeSearch" || e.target.closest("#closeSearch")) {
        e.preventDefault();
        this.closeSearchResults();
      }

      // View in feed button for search results
      if (e.target.closest(".post__action--view-feed")) {
        e.preventDefault();

        const postId = e.target.closest(".post").dataset.postId;
        this.viewPostInMainFeed(postId);
      }
    });

    // Search input events
    document.addEventListener("keydown", (e) => {
      const searchInput = document.getElementById("searchInput");
      if (e.target === searchInput) {
        if (e.key === "Enter") {
          e.preventDefault();
          this.performSearch();
        } else if (e.key === "Escape") {
          this.clearSearch();
        }
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target.id === "searchInput") {
        this.handleSearchInput(e.target.value);
      }
    });
  }

  // Search functionality methods
  handleSearchInput(value) {
    const clearBtn = document.getElementById("clearSearch");
    if (clearBtn) {
      clearBtn.style.display = value ? "flex" : "none";
    }
  }

  async performSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (!searchInput || this.isSearching) return;

    const query = searchInput.value.trim();
    if (!query) {
      this.showNotification("Please enter a username to search", "warning");
      return;
    }

    this.currentQuery = query;
    this.isSearching = true;

    // Update UI to show loading state
    if (searchBtn) {
      searchBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Searching...';
      searchBtn.disabled = true;
    }

    try {
      // Search for posts by username
      const posts = await this.searchPostsByUsername(query);
      this.searchResults = posts;
      this.displaySearchResults(posts, query);
    } catch (error) {
      console.error("Search error:", error);
      this.showNotification("Search failed. Please try again.", "error");
    } finally {
      this.isSearching = false;
      // Reset button state
      if (searchBtn) {
        searchBtn.innerHTML = '<i class="fas fa-search"></i> Search';
        searchBtn.disabled = false;
      }
    }
  }

  async searchPostsByUsername(username) {
    try {
      // Use existing posts or fetch from API
      const response = await fetch("http://localhost:3000/api/posts", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }

      const allPosts = await response.json();

      // Filter posts by username (case-insensitive partial match)
      const filteredPosts = allPosts.filter((post) => {
        const fullName = `${post.FirstName || ""} ${post.LastName || ""}`
          .trim()
          .toLowerCase();
        const firstName = (post.FirstName || "").toLowerCase();
        const lastName = (post.LastName || "").toLowerCase();
        const searchTerm = username.toLowerCase();

        return (
          fullName.includes(searchTerm) ||
          firstName.includes(searchTerm) ||
          lastName.includes(searchTerm)
        );
      });

      // Format posts for display
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "null"
      );
      const currentUserId = currentUser ? currentUser.id : null;

      const formattedPosts = await Promise.all(
        filteredPosts.map(async (post) => {
          // Get comment count for each post
          let commentCount = 0;
          try {
            const commentResponse = await fetch(
              `http://localhost:3000/api/comments/post/${post.PostID}`,
              {
                method: "GET",
                credentials: "include",
              }
            );
            if (commentResponse.ok) {
              const comments = await commentResponse.json();
              commentCount = comments.length;
            }
          } catch (error) {}

          // Get like count and user's like status for each post
          let likeCount = 0;
          let isLiked = false;
          try {
            const likeResponse = await fetch(
              `http://localhost:3000/api/likes/post/${post.PostID}`,
              {
                method: "GET",
                credentials: "include",
              }
            );
            if (likeResponse.ok) {
              const likeData = await likeResponse.json();
              likeCount = likeData.totalLikes;

              // Check if current user has liked this post
              if (currentUserId && likeData.likes) {
                isLiked = likeData.likes.some(
                  (like) => like.UserID === currentUserId
                );
              }
            }
          } catch (error) {}

          return {
            id: post.PostID,
            author: `${post.FirstName} ${post.LastName}`,
            role: post.JobTitle,
            time: this.formatDate(post.DatePosted),
            content: post.Content,
            image: post.ImageURL,
            likes: likeCount,
            comments: commentCount,
            shares: 0,
            isLiked: isLiked,
          };
        })
      );

      return formattedPosts;
    } catch (error) {
      console.error("Error searching posts:", error);
      throw error;
    }
  }

  displaySearchResults(posts, query) {
    const searchResults = document.getElementById("searchResults");
    const searchResultsTitle = document.getElementById("searchResultsTitle");
    const searchResultsList = document.getElementById("searchResultsList");

    if (!searchResults || !searchResultsList) return;

    // Update title
    if (searchResultsTitle) {
      searchResultsTitle.textContent = `Search Results for "${query}" (${posts.length} found)`;
    }

    // Clear previous results
    searchResultsList.innerHTML = "";

    if (posts.length === 0) {
      searchResultsList.innerHTML = `
        <div class="no-results">
          <i class="fas fa-search"></i>
          <h4>No posts found</h4>
          <p>No posts were found for username "${query}". Try searching with a different name.</p>
        </div>
      `;
    } else {
      // Use existing createPostHTML method and add search-specific features
      const postsHTML = posts
        .map((post) => this.createSearchResultPostHTML(post))
        .join("");
      searchResultsList.innerHTML = postsHTML;
    }

    // Show search results
    searchResults.style.display = "block";
    searchResults.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  createSearchResultPostHTML(post) {
    const likeIcon = post.isLiked ? "fas fa-thumbs-up" : "far fa-thumbs-up";
    const likeClass = post.isLiked ? "post__action--liked" : "";
    const avatarInitials = this.headerManager
      ? this.headerManager.getUserInitials(post.author)
      : this.getInitials(post.author);

    return `
      <div class="post search-result-post" data-post-id="${post.id}">
        <div class="post__header">
          <div class="post__avatar">
            <div class="avatar">${avatarInitials}</div>
          </div>
          <div class="post__info">
            <div class="post__author">${post.author}</div>
            <div class="post__meta">${post.role} • ${post.time}</div>
          </div>
        </div>
        <div class="post__content">${post.content}</div>
        ${
          post.image
            ? `
          <div class="post__image">
            <img src="${post.image}" alt="Post image">
          </div>
        `
            : ""
        }
        <div class="post__actions">
          <button type="button" class="post__action ${likeClass}">
            <i class="${likeIcon}"></i>
            <span>${post.likes} Likes</span>
          </button>
          <button type="button" class="post__action">
            <i class="far fa-comment"></i>
            <span>${post.comments} Comments</span>
          </button>
          <button type="button" class="post__action">
            <i class="fas fa-share-alt"></i>
            <span>${post.shares} Shares</span>
          </button>
          <button type="button" class="post__action post__action--view-feed">
            <i class="fas fa-external-link-alt"></i>
            <span>View in Feed</span>
          </button>
        </div>
      </div>
    `;
  }

  viewPostInMainFeed(postId) {
    // Close search results
    this.closeSearchResults();

    // Clear search input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.value = "";
    }

    // Scroll to the post in the main feed if it exists
    const mainFeedPost = document.querySelector(
      `#postsFeed .post[data-post-id="${postId}"]`
    );
    if (mainFeedPost) {
      mainFeedPost.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight the post temporarily
      mainFeedPost.style.backgroundColor =
        "rgba(var(--color-primary-rgb), 0.1)";
      mainFeedPost.style.transition = "background-color 0.3s ease";

      setTimeout(() => {
        mainFeedPost.style.backgroundColor = "";
      }, 3000);

      this.showNotification("Post found in main feed", "success");
    } else {
      // If post not visible in main feed, refresh posts and then scroll
      this.refreshPosts().then(() => {
        setTimeout(() => {
          const refreshedPost = document.querySelector(
            `#postsFeed .post[data-post-id="${postId}"]`
          );
          if (refreshedPost) {
            refreshedPost.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            this.showNotification("Post found in main feed", "success");
          } else {
            this.showNotification(
              "Post not currently visible in main feed",
              "info"
            );
          }
        }, 500);
      });
    }
  }

  clearSearch() {
    const searchInput = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearch");

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    if (clearBtn) {
      clearBtn.style.display = "none";
    }

    this.closeSearchResults();
  }

  closeSearchResults() {
    const searchResults = document.getElementById("searchResults");
    if (searchResults) {
      searchResults.style.display = "none";
    }
    this.searchResults = [];
    this.currentQuery = "";
  }

  editComment(commentId) {
    const comment = this.findComment(commentId);
    if (!comment) return;

    this.currentEditingComment = commentId;
    const commentElement = document.querySelector(
      `[data-comment-id="${commentId}"]`
    );
    const contentElement = commentElement.querySelector(".comment__text");

    const originalText = comment.content;
    contentElement.innerHTML = `
      <div class="edit-form">
        <textarea class="edit-textarea" placeholder="Edit your comment...">${originalText}</textarea>
        <div class="edit-actions">
          <div class="edit-buttons">
            <button class="btn btn--secondary btn--small edit-cancel" type="button">Cancel</button>
            <button class="btn btn--primary btn--small edit-save" type="button">Save</button>
          </div>
        </div>
      </div>
    `;

    // Auto-resize textarea
    const textarea = contentElement.querySelector(".edit-textarea");
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    textarea.focus();

    // Auto-resize on input
    textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });
  }

  async saveCommentEdit(saveBtn) {
    const commentElement = saveBtn.closest(".comment");
    const commentId = Number.parseInt(commentElement.dataset.commentId);
    const textarea = commentElement.querySelector(".edit-textarea");
    const newContent = textarea.value.trim();

    if (!newContent) {
      this.showNotification("Comment cannot be empty", "warning");
      return;
    }

    // Check if content has actually changed
    const originalComment = this.findComment(commentId);
    if (originalComment && newContent === originalComment.content) {
      this.currentEditingComment = null;
      this.showComments(this.currentPostId);
      return;
    }

    // Prevent multiple submissions
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      // Update comment in database
      const response = await fetch(
        `http://localhost:3000/api/comments/${commentId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            commentText: newContent,
          }),
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update comment" }));
        throw new Error(error.error || "Failed to update comment");
      }

      // Update local comment data
      const comment = this.findComment(commentId);
      if (comment) {
        comment.content = newContent;
        comment.edited = true;
        comment.editedTime = "Just now";
      }

      this.currentEditingComment = null;
      this.showComments(this.currentPostId);
      this.showNotification("Comment updated successfully!", "success");
    } catch (error) {
      console.error("Comment update error:", error);
      this.showNotification(
        error.message || "Failed to update comment",
        "error"
      );

      // Re-enable button on error
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }

  cancelCommentEdit(cancelBtn) {
    this.currentEditingComment = null;
    this.showComments(this.currentPostId);
  }

  async deleteComment(commentId) {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      // Delete comment from database
      const response = await fetch(
        `http://localhost:3000/api/comments/${commentId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to delete comment" }));
        throw new Error(error.error || "Failed to delete comment");
      }

      // Remove the comment from local storage
      const postComments = this.comments[this.currentPostId] || [];
      const commentIndex = postComments.findIndex((c) => c.id === commentId);

      if (commentIndex !== -1) {
        postComments.splice(commentIndex, 1);
      }

      // Update comment count on post
      const post = this.posts.find((p) => p.id === this.currentPostId);
      if (post) {
        post.comments--;
      }

      this.showComments(this.currentPostId);
      this.renderPosts();
      this.showNotification("Comment deleted successfully!", "success");
    } catch (error) {
      console.error("Comment deletion error:", error);
      this.showNotification(
        error.message || "Failed to delete comment",
        "error"
      );
    }
  }

  async deletePost(postId) {
    // Check if post exists locally first
    const localPost = this.posts.find((p) => p.id === postId);

    if (!localPost) {
      this.showNotification("Error: Post not found", "error");
      return;
    }

    if (
      !confirm(
        "Are you sure you want to delete this post? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      // Delete post from database
      const response = await fetch(
        `http://localhost:3000/api/posts/${postId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
        } catch (e) {
          console.error("Could not read error response:", e);
          errorText = "";
        }

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        // Handle 404 error (post already deleted or doesn't exist)
        if (response.status === 404) {
          console.warn("Post not found in database, removing from frontend");

          // Remove post from local array since it doesn't exist in DB
          const postIndex = this.posts.findIndex((p) => p.id === postId);
          if (postIndex !== -1) {
            this.posts.splice(postIndex, 1);
          }

          // Remove associated comments
          delete this.comments[postId];

          // Update UI
          this.renderPosts();
          this.showNotification("Post was already deleted", "warning");
          return;
        }

        throw new Error(
          errorData.error || `Failed to delete post (${response.status})`
        );
      }

      // Successfully deleted from database
      const responseData = await response.json();

      // Remove post from local array
      const postIndex = this.posts.findIndex((p) => p.id === postId);
      if (postIndex !== -1) {
        this.posts.splice(postIndex, 1);
      }

      // Remove associated comments
      delete this.comments[postId];

      // Update UI
      this.renderPosts();
      this.showNotification("Post deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting post:", error);
      this.showNotification(error.message || "Failed to delete post", "error");
    }
  }

  editPost(postId) {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return;

    // Close any open dropdowns first
    document.querySelectorAll(".post__dropdown.show").forEach((dropdown) => {
      dropdown.classList.remove("show");
    });

    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    const contentElement = postElement.querySelector(".post__content");
    const imageElement = postElement.querySelector(".post__image");

    // Store original content and image for cancellation
    const originalContent = post.content;
    const originalImage = post.image;

    // Create edit form
    const editFormHTML = `
      <div class="post-edit-form">
        <textarea class="post-edit-textarea" placeholder="Edit your post...">${originalContent}</textarea>
        ${
          originalImage
            ? `
          <div class="post-edit-image">
            <img src="${originalImage}" alt="Post image">
            <button type="button" class="post-edit-remove-image" title="Remove image">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `
            : ""
        }
        <div class="post-edit-actions">
          <div class="post-edit-options">
            <button type="button" class="post-edit-attach-image" title="Add image">
              <i class="fas fa-image"></i> Add Image
            </button>
            <input type="file" class="post-edit-image-input" accept="image/*" style="display: none;">
          </div>
          <div class="post-edit-buttons">
            <button class="btn btn--secondary btn--small post-edit-cancel" type="button">Cancel</button>
            <button class="btn btn--primary btn--small post-edit-save" type="button">Save Post</button>
          </div>
        </div>
      </div>
    `;

    // Replace content with edit form
    contentElement.innerHTML = editFormHTML;

    // Hide image element during editing
    if (imageElement) {
      imageElement.style.display = "none";
    }

    // Setup edit form functionality
    this.setupPostEditForm(postElement, postId, originalContent, originalImage);
  }

  setupPostEditForm(postElement, postId, originalContent, originalImage) {
    const textarea = postElement.querySelector(".post-edit-textarea");
    const attachImageBtn = postElement.querySelector(".post-edit-attach-image");
    const imageInput = postElement.querySelector(".post-edit-image-input");
    const removeImageBtn = postElement.querySelector(".post-edit-remove-image");
    const saveBtn = postElement.querySelector(".post-edit-save");
    const cancelBtn = postElement.querySelector(".post-edit-cancel");

    let currentImage = originalImage;

    // Auto-resize textarea
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    textarea.focus();

    // Auto-resize on input
    textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });

    // Image attachment
    if (attachImageBtn && imageInput) {
      attachImageBtn.addEventListener("click", () => imageInput.click());
      imageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (event) => {
            currentImage = event.target.result;
            this.updatePostEditImage(postElement, currentImage);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Remove image
    if (removeImageBtn) {
      removeImageBtn.addEventListener("click", () => {
        currentImage = null;
        this.updatePostEditImage(postElement, null);
      });
    }

    // Save post
    saveBtn.addEventListener("click", () => {
      this.savePostEdit(
        postId,
        textarea.value.trim(),
        currentImage,
        originalContent,
        originalImage
      );
    });

    // Cancel edit
    cancelBtn.addEventListener("click", () => {
      this.cancelPostEdit(postId, originalContent, originalImage);
    });
  }

  updatePostEditImage(postElement, imageUrl) {
    const imageContainer = postElement.querySelector(".post-edit-image");
    const attachBtn = postElement.querySelector(".post-edit-attach-image");

    if (imageUrl) {
      if (imageContainer) {
        imageContainer.querySelector("img").src = imageUrl;
      } else {
        // Create new image container
        const newImageHTML = `
          <div class="post-edit-image">
            <img src="${imageUrl}" alt="Post image">
            <button type="button" class="post-edit-remove-image" title="Remove image">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
        postElement
          .querySelector(".post-edit-textarea")
          .insertAdjacentHTML("afterend", newImageHTML);

        // Re-attach remove event listener
        const newRemoveBtn = postElement.querySelector(
          ".post-edit-remove-image"
        );
        newRemoveBtn.addEventListener("click", () => {
          this.updatePostEditImage(postElement, null);
        });
      }
      attachBtn.innerHTML = '<i class="fas fa-check"></i> Image Added';
      attachBtn.style.color = "var(--success)";
    } else {
      if (imageContainer) {
        imageContainer.remove();
      }
      attachBtn.innerHTML = '<i class="fas fa-image"></i> Add Image';
      attachBtn.style.color = "";
    }
  }

  async savePostEdit(
    postId,
    newContent,
    newImage,
    originalContent,
    originalImage
  ) {
    if (!newContent) {
      this.showNotification("Post content cannot be empty", "warning");
      return;
    }

    // Check if content has actually changed
    if (newContent === originalContent && newImage === originalImage) {
      this.cancelPostEdit(postId, originalContent, originalImage);
      return;
    }

    const saveBtn = document.querySelector(".post-edit-save");
    if (saveBtn.disabled) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      // Update post in database
      const response = await fetch(
        `http://localhost:3000/api/posts/${postId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            content: newContent,
            image_url: newImage,
          }),
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update post" }));
        throw new Error(error.error || "Failed to update post");
      }

      // Update local post data
      const post = this.posts.find((p) => p.id === postId);
      if (post) {
        post.content = newContent;
        post.image = newImage;
      }

      // Re-render posts to show updated content
      this.renderPosts();
      this.showNotification("Post updated successfully!", "success");
    } catch (error) {
      console.error("Post update error:", error);
      this.showNotification(error.message || "Failed to update post", "error");

      // Re-enable button on error
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Post";
    }
  }

  cancelPostEdit(postId, originalContent, originalImage) {
    const post = this.posts.find((p) => p.id === postId);
    if (post) {
      post.content = originalContent;
      post.image = originalImage;
    }

    // Re-render posts to restore original content
    this.renderPosts();
  }

  findComment(commentId) {
    const postComments = this.comments[this.currentPostId] || [];

    // Search in top-level comments
    for (const comment of postComments) {
      if (comment.id === commentId) {
        return comment;
      }
    }
    return null;
  }

  // Rest of the existing methods with enhancements...
  handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imagePreview = document.getElementById("imagePreview");
        const previewImg = document.getElementById("previewImg");

        previewImg.src = e.target.result;
        imagePreview.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    const imagePreview = document.getElementById("imagePreview");
    const imageInput = document.getElementById("imageInput");
    const previewImg = document.getElementById("previewImg");

    imagePreview.style.display = "none";
    previewImg.src = "";
    imageInput.value = "";
  }

  async submitPost() {
    // Check user access with improved login/community checks
    const accessCheck = this.checkUserAccess("post");
    if (!accessCheck.allowed) {
      this.showNotification(accessCheck.message, "warning", 5000);

      // Only highlight join button if user is logged in but not in community
      if (accessCheck.type === "community_required") {
        const joinBtn = document.getElementById("joinCommunityBtn");
        if (joinBtn && joinBtn.style.display !== "none") {
          joinBtn.style.animation = "pulse 1s ease-in-out 3 alternate";
          setTimeout(() => {
            joinBtn.style.animation = "";
          }, 3000);
        }
      }

      return;
    }

    const postContent = document.getElementById("postContent");
    const imageInput = document.getElementById("imageInput");

    const content = postContent.value.trim();
    if (!content) {
      this.showNotification(
        "Please enter some content for your post",
        "warning"
      );
      return;
    }

    try {
      // Handle image upload (simple data URL for now)
      let imageUrl = null;
      if (imageInput.files[0]) {
        const reader = new FileReader();
        imageUrl = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(imageInput.files[0]);
        });
      }

      // Check for current logged-in user
      let currentUserId = null;
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "null"
      );
      if (currentUser && currentUser.id) {
        currentUserId = currentUser.id;
      }

      // Send post to database
      const response = await fetch("http://localhost:3000/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          content: content,
          image_url: imageUrl,
          currentUserId: currentUserId, // Send the current user ID
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create post" }));
        throw new Error(error.error || "Failed to create post");
      }

      const newPost = await response.json();

      // Add to local posts array for immediate display
      const formattedPost = {
        id: newPost.PostID,
        author: `${newPost.FirstName} ${newPost.LastName}`,
        role: newPost.JobTitle || "Member",
        time: "Just now",
        content: newPost.Content,
        image: newPost.ImageURL,
        likes: 0,
        comments: 0,
        shares: 0,
        isLiked: false,
      };

      this.addPost(formattedPost);

      // Clear form
      postContent.value = "";
      postContent.style.height = "auto";
      this.removeImage();

      this.showNotification("Post created successfully!", "success");
    } catch (error) {
      console.error("Post creation error:", error);
    }
  }

  addPost(post) {
    this.posts.unshift(post);
    this.comments[post.id] = [];
    this.renderPosts();
  }

  renderPosts() {
    const postsFeed = document.getElementById("postsFeed");
    if (!postsFeed) return;

    if (this.posts.length === 0) {
      postsFeed.innerHTML = `
        <div class="posts-empty">
          <div class="posts-empty__icon">
            <i class="far fa-comments"></i>
          </div>
          <h3 class="posts-empty__title">No posts yet</h3>
          <p class="posts-empty__text">Be the first to share something with the community!</p>
        </div>
      `;
      return;
    }

    const postsHTML = this.posts
      .map((post) => this.createPostHTML(post))
      .join("");
    postsFeed.innerHTML = postsHTML;
  }

  createPostHTML(post) {
    const likeIcon = post.isLiked ? "fas fa-thumbs-up" : "far fa-thumbs-up";
    const likeClass = post.isLiked ? "post__action--liked" : "";
    const avatarInitials = this.headerManager
      ? this.headerManager.getUserInitials(post.author)
      : this.getInitials(post.author);

    return `
      <div class="post" data-post-id="${post.id}">
        <div class="post__header">
          <div class="post__avatar">
            <div class="avatar">${avatarInitials}</div>
          </div>
          <div class="post__info">
            <div class="post__author">${post.author}</div>
            <div class="post__meta">${post.role} • ${post.time}</div>
          </div>
          ${
            this.isCurrentUserPost(post)
              ? `
            <div class="post__menu">
              <button class="post__menu-btn" type="button" onclick="this.nextElementSibling.classList.toggle('show')">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div class="post__dropdown">
                <button class="post__dropdown-item post__edit" type="button">
                  <i class="fas fa-edit"></i> Edit Post
                </button>
                <button class="post__dropdown-item post__delete" type="button">
                  <i class="fas fa-trash"></i> Delete Post
                </button>
              </div>
            </div>
          `
              : ""
          }
        </div>
        <div class="post__content">${post.content}</div>
        ${
          post.image
            ? `
          <div class="post__image">
            <img src="${post.image}" alt="Post image">
          </div>
        `
            : ""
        }
        <div class="post__actions">
          <button type="button" class="post__action ${likeClass}">
            <i class="${likeIcon}"></i>
            <span>${post.likes} Likes</span>
          </button>
          <button type="button" class="post__action">
            <i class="far fa-comment"></i>
            <span>${post.comments} Comments</span>
          </button>
          <button type="button" class="post__action">
            <i class="fas fa-share-alt"></i>
            <span>${post.shares} Shares</span>
          </button>
        </div>
      </div>
    `;
  }

  isCurrentUserPost(post) {
    // Use header manager for consistent user checking
    if (this.headerManager) {
      return this.headerManager.isCurrentUserContent(post.author, post.userId);
    }

    // Fallback to original logic
    const currentUser = JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );
    if (currentUser) {
      const currentUserName = `${
        currentUser.firstName || currentUser.FirstName || ""
      } ${currentUser.lastName || currentUser.LastName || ""}`.trim();
      return post.author === currentUserName;
    }
    return post.author === "You";
  }

  async toggleLike(postId, actionElement) {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return;

    // Get current user ID
    const currentUser = JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );
    const currentUserId = currentUser
      ? currentUser.id || currentUser.UserID
      : null;

    if (!currentUser || !currentUserId) {
      this.showNotification("Please log in to like posts", "warning");
      return;
    }

    // Disable button during API call
    actionElement.disabled = true;
    const originalText = actionElement.querySelector("span").textContent;
    actionElement.querySelector("span").textContent = "...";

    try {
      // Call the toggle like API
      const response = await fetch("http://localhost:3000/api/likes/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          postId: postId,
          userId: currentUserId,
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to toggle like" }));
        throw new Error(error.error || "Failed to toggle like");
      }

      const result = await response.json();

      // Update local post data with server response
      post.isLiked = result.isLiked;
      post.likes = result.totalLikes;

      // Update the UI based on server response
      this.updateLikeButton(actionElement, post.isLiked, post.likes);

      // Show success notification
      this.showNotification(
        result.action === "liked" ? "Post liked!" : "Like removed!",
        "success"
      );
    } catch (error) {
      console.error("Like toggle error:", error);
      this.showNotification(error.message || "Failed to update like", "error");

      // Restore original text on error
      actionElement.querySelector("span").textContent = originalText;
    } finally {
      // Re-enable button
      actionElement.disabled = false;
    }
  }

  updateLikeButton(actionElement, isLiked, likeCount) {
    const icon = actionElement.querySelector("i");
    const span = actionElement.querySelector("span");

    if (isLiked) {
      icon.className = "fas fa-thumbs-up";
      actionElement.classList.add("post__action--liked");
    } else {
      icon.className = "far fa-thumbs-up";
      actionElement.classList.remove("post__action--liked");
    }

    span.textContent = `${likeCount} Likes`;
  }

  async toggleCommentLike(commentId, actionElement) {
    const comment = this.findComment(commentId);
    if (!comment) return;

    // Get current user ID
    const currentUser = JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );
    const currentUserId = currentUser
      ? currentUser.id || currentUser.UserID
      : null;

    if (!currentUser || !currentUserId) {
      this.showNotification("Please log in to like comments", "warning");
      return;
    }

    // Disable button during API call
    actionElement.disabled = true;
    const originalText = actionElement.querySelector("span").textContent;
    actionElement.querySelector("span").textContent = "...";

    try {
      // Call the toggle like API for comment
      const response = await fetch("http://localhost:3000/api/likes/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          commentId: commentId,
          userId: currentUserId,
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to toggle comment like" }));
        throw new Error(error.error || "Failed to toggle comment like");
      }

      const result = await response.json();

      // Update local comment data with server response
      comment.isLiked = result.isLiked;
      comment.likes = result.totalLikes;

      // Update the UI based on server response
      this.updateCommentLikeButton(
        actionElement,
        comment.isLiked,
        comment.likes
      );

      // Refresh the comments display to ensure consistency
      setTimeout(() => {
        const commentsList = document.getElementById("commentsList");
        if (commentsList && this.currentPostId) {
          const postComments = this.comments[this.currentPostId] || [];
          const commentsHTML = postComments
            .map((comment) => this.createCommentHTML(comment))
            .join("");
          commentsList.innerHTML = commentsHTML;
        }
      }, 100);

      // Show success notification
      this.showNotification(
        result.action === "liked" ? "Comment liked!" : "Like removed!",
        "success"
      );
    } catch (error) {
      console.error("Comment like toggle error:", error);
      this.showNotification(
        error.message || "Failed to update comment like",
        "error"
      );

      // Restore original text on error
      actionElement.querySelector("span").textContent = originalText;
    } finally {
      // Re-enable button
      actionElement.disabled = false;
    }
  }

  updateCommentLikeButton(actionElement, isLiked, likeCount) {
    const icon = actionElement.querySelector("i");
    const span = actionElement.querySelector("span");

    if (isLiked) {
      icon.className = "fas fa-thumbs-up";
      actionElement.classList.add("comment__action--liked");
    } else {
      icon.className = "far fa-thumbs-up";
      actionElement.classList.remove("comment__action--liked");
    }

    span.textContent = `${likeCount} Likes`;
  }

  // Helper method to load like data for a specific post
  async loadPostLikeData(postId) {
    try {
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "null"
      );
      const currentUserId = currentUser
        ? currentUser.id || currentUser.UserID
        : null;

      const response = await fetch(
        `http://localhost:3000/api/likes/post/${postId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.ok) {
        const likeData = await response.json();
        const post = this.posts.find((p) => p.id === postId);

        if (post) {
          post.likes = likeData.totalLikes;
          post.isLiked =
            currentUserId && likeData.likes
              ? likeData.likes.some(
                  (like) =>
                    like.UserID === currentUserId ||
                    like.UserID === currentUser.id ||
                    like.UserID === currentUser.UserID
                )
              : false;
        }

        return {
          totalLikes: likeData.totalLikes,
          isLiked: post ? post.isLiked : false,
        };
      }
    } catch (error) {
      console.error("Error loading like data:", error);
    }

    return null;
  }

  async showComments(postId) {
    this.currentPostId = postId;
    const modal = document.getElementById("commentModal");
    const modalOverlay = document.getElementById("modalOverlay");
    const commentsList = document.getElementById("commentsList");
    const submitCommentBtn = document.getElementById("submitComment");

    // Disable comment button if user not in community
    if (submitCommentBtn) {
      this.updateCommentButtonState(submitCommentBtn);
    }

    // Load comments from database
    await this.loadCommentsFromDatabase(postId);

    // Get comments for this post
    const postComments = this.comments[postId] || [];

    if (postComments.length === 0) {
      commentsList.innerHTML = `
        <div class="comments-empty">
          <i class="far fa-comments"></i>
          <h4>No comments yet</h4>
          <p>Be the first to share your thoughts on this post!</p>
        </div>
      `;
    } else {
      const commentsHTML = postComments
        .map((comment) => this.createCommentHTML(comment))
        .join("");
      commentsList.innerHTML = commentsHTML;
    }

    modalOverlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  async loadCommentsFromDatabase(postId) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/comments/post/${postId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load comments");
      }

      const comments = await response.json();

      // Get current user for like status checking
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "null"
      );
      const currentUserId = currentUser
        ? currentUser.id || currentUser.UserID
        : null;

      // Format comments and store them, then load like data
      const formattedComments = await Promise.all(
        comments.map(async (comment) => {
          const formattedComment = {
            id: comment.CommentID,
            postId: comment.PostID,
            userId: comment.UserID, // Include user ID for better matching
            author: `${comment.FirstName} ${comment.LastName}`,
            time: this.formatDate(comment.DateCommented),
            content: comment.CommentText,
            edited: comment.IsEdited || false,
            editedTime: comment.DateEdited
              ? this.formatDate(comment.DateEdited)
              : null,
            likes: 0,
            isLiked: false,
          };

          // Load like count and user's like status for this comment
          try {
            const likeResponse = await fetch(
              `http://localhost:3000/api/likes/comment/${comment.CommentID}`,
              {
                method: "GET",
                credentials: "include",
              }
            );

            if (likeResponse.ok) {
              const likeData = await likeResponse.json();
              formattedComment.likes = likeData.totalLikes;

              // Check if current user has liked this comment
              if (currentUserId && likeData.likes) {
                formattedComment.isLiked = likeData.likes.some(
                  (like) =>
                    like.UserID === currentUserId ||
                    like.UserID === currentUser.id ||
                    like.UserID === currentUser.UserID
                );
              }
            }
          } catch (likeError) {
            console.error(
              "Error loading likes for comment:",
              comment.CommentID,
              likeError
            );
          }

          return formattedComment;
        })
      );

      this.comments[postId] = formattedComments;

      // Update comment count on post
      const post = this.posts.find((p) => p.id === postId);
      if (post) {
        post.comments = formattedComments.length;
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
      this.showNotification("Failed to load comments", "error");
    }
  }

  createCommentHTML(comment) {
    const editedText = comment.edited
      ? `<span class="comment__edited">(edited ${comment.editedTime})</span>`
      : "";

    // Check if this is the current user's comment using header manager
    const isCurrentUserComment = this.isCurrentUserComment(comment);
    const avatarInitials = this.headerManager
      ? this.headerManager.getUserInitials(comment.author)
      : this.getInitials(comment.author);

    // Like button styling
    const likeIcon = comment.isLiked ? "fas fa-thumbs-up" : "far fa-thumbs-up";
    const likeClass = comment.isLiked ? "comment__action--liked" : "";

    return `
      <div class="comment" data-comment-id="${comment.id}">
        <div class="comment__avatar">
          <div class="avatar">${avatarInitials}</div>
        </div>
        <div class="comment__content">
          <div class="comment__header">
            <span class="comment__author">${comment.author}</span>
            <span class="comment__time">${comment.time}</span>
            ${editedText}
          </div>
          <div class="comment__text">${comment.content}</div>
          <div class="comment__actions">
            <button class="comment__action comment__like ${likeClass}" type="button">
              <i class="${likeIcon}"></i>
              <span>${comment.likes || 0} Likes</span>
            </button>
            ${
              isCurrentUserComment
                ? `
              <button class="comment__action comment__edit" type="button">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="comment__action comment__delete" type="button">
                <i class="fas fa-trash"></i> Delete
              </button>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  }

  isCurrentUserComment(comment) {
    // Use header manager for consistent user checking
    if (this.headerManager) {
      return this.headerManager.isCurrentUserContent(
        comment.author,
        comment.userId
      );
    }

    // Fallback to original logic
    const currentUser = JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );

    if (currentUser) {
      // Try multiple ways to match the user
      const currentUserName = `${currentUser.firstName || ""} ${
        currentUser.lastName || ""
      }`.trim();
      const currentUserFullName = `${currentUser.FirstName || ""} ${
        currentUser.LastName || ""
      }`.trim();

      // Check both possible name formats and user ID if available
      return (
        comment.author === currentUserName ||
        comment.author === currentUserFullName ||
        comment.author === "You" ||
        (comment.userId &&
          currentUser.id &&
          comment.userId === currentUser.id) ||
        (comment.userId &&
          currentUser.UserID &&
          comment.userId === currentUser.UserID)
      );
    }

    return comment.author === "You";
  }

  closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    const commentContent = document.getElementById("commentContent");

    modalOverlay.classList.remove("show");
    document.body.style.overflow = "auto";

    // Reset comment form
    if (commentContent) commentContent.value = "";
    this.currentEditingComment = null;
  }

  async submitComment() {
    // Check user access with improved login/community checks
    const accessCheck = this.checkUserAccess("comment");
    if (!accessCheck.allowed) {
      this.showNotification(accessCheck.message, "warning", 5000);

      // Close modal for any access denial
      this.closeModal();

      // Only highlight join button if user is logged in but not in community
      if (accessCheck.type === "community_required") {
        const joinBtn = document.getElementById("joinCommunityBtn");
        if (joinBtn && joinBtn.style.display !== "none") {
          joinBtn.style.animation = "pulse 1s ease-in-out 3 alternate";
          setTimeout(() => {
            joinBtn.style.animation = "";
          }, 3000);
        }
      }

      return;
    }
    const commentContent = document.getElementById("commentContent");
    const content = commentContent.value.trim();

    if (!content) {
      this.showNotification("Please enter a comment", "warning");
      return;
    }

    try {
      // Get current user ID
      let currentUserId = null;
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "null"
      );
      if (currentUser && currentUser.id) {
        currentUserId = currentUser.id;
      }

      // Send comment to database
      const response = await fetch("http://localhost:3000/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          postId: this.currentPostId,
          commentText: content,
          currentUserId: currentUserId,
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create comment" }));
        throw new Error(error.error || "Failed to create comment");
      }

      const newCommentFromDB = await response.json();
      console.log("Comment created:", newCommentFromDB);

      // Format the new comment for local display
      const newComment = {
        id: newCommentFromDB.CommentID,
        postId: newCommentFromDB.PostID,
        userId: newCommentFromDB.UserID, // Include user ID for better matching
        author: `${newCommentFromDB.FirstName} ${newCommentFromDB.LastName}`,
        time: "Just now",
        content: newCommentFromDB.CommentText,
        edited: false,
        likes: 0,
        isLiked: false,
      };

      this.addComment(newComment);

      this.showNotification("Comment added successfully!", "success");
    } catch (error) {
      console.error("Comment creation error:", error);
      this.showNotification(error.message || "Failed to add comment", "error");
    }
  }

  addComment(comment) {
    if (!this.comments[this.currentPostId]) {
      this.comments[this.currentPostId] = [];
    }

    this.comments[this.currentPostId].push(comment);

    // Update comment count on post
    const post = this.posts.find((p) => p.id === this.currentPostId);
    if (post) {
      post.comments = this.comments[this.currentPostId].length;
    }

    // Refresh comments display
    this.showComments(this.currentPostId);
    this.renderPosts();

    // Clear form
    const commentContent = document.getElementById("commentContent");
    commentContent.value = "";
  }

  sharePost(postId) {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return;

    if (navigator.share) {
      navigator.share({
        title: "MConnect - Mining Operations Community",
        text: post.content,
        url: window.location.href,
      });
    } else {
      // Fallback - copy to clipboard
      const textToCopy = `${post.content}\n\n- ${post.author}, ${post.role}`;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          this.showNotification("Post content copied to clipboard!", "success");
        })
        .catch(() => {
          this.showNotification("Unable to copy to clipboard", "error");
        });
    }

    // Increment share count
    post.shares++;
    this.renderPosts();
  }

  updateFormAvatars() {
    // Update form avatars to show current user's initials
    if (!this.headerManager) return;

    const newPostAvatar = document.getElementById("newPostUserAvatar");
    const commentFormAvatar = document.getElementById("commentUserAvatar");

    const currentUserInitials = this.headerManager.getUserInitials();

    if (newPostAvatar) {
      newPostAvatar.textContent = currentUserInitials;
    }

    if (commentFormAvatar) {
      commentFormAvatar.textContent = currentUserInitials;
    }
  }

  getInitials(name) {
    // Keep the fallback method but prefer header manager
    if (this.headerManager) {
      return this.headerManager.getUserInitials(name);
    }

    // Fallback implementation
    if (!name || typeof name !== "string") {
      return "AU"; // Default fallback
    }

    const words = name
      .trim()
      .split(" ")
      .filter((word) => word.length > 0);

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

  showNotification(message, type = "info", timeout = 3000) {
    // Log notification to console
    console.log(`[${type.toUpperCase()}] ${message}`);
    console.log(`Notification timeout: ${timeout}ms`);

    // Remove existing notifications
    const existingNotifications = document.querySelectorAll(".notification");
    existingNotifications.forEach((notification) => notification.remove());

    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification notification--${type}`;
    notification.innerHTML = `
      <div class="notification__content">
        <i class="fas fa-${
          type === "success"
            ? "check-circle"
            : type === "error"
            ? "exclamation-circle"
            : type === "warning"
            ? "exclamation-triangle"
            : "info-circle"
        }"></i>
        <span>${message}</span>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(notification);
    console.log("Notification element added to DOM:", notification);

    // Auto-remove after specified timeout
    setTimeout(() => {
      notification.remove();
      console.log("Notification removed after timeout");
    }, timeout);
  }

  formatDate(dateString) {
    if (!dateString) return "Just now";

    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
    } else if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  // Loading display methods
  showPostsLoading() {
    const postsFeed = document.getElementById("postsFeed");
    if (!postsFeed) return;

    postsFeed.innerHTML = `
      <div class="posts-loading">
        <div class="posts-loading__spinner"></div>
        <div class="posts-loading__text">Loading posts...</div>
        <div class="posts-loading__subtext">Please wait while we fetch the latest content</div>
      </div>
    `;
  }

  showPostsSkeleton(count = 3) {
    const postsFeed = document.getElementById("postsFeed");
    if (!postsFeed) return;

    const skeletonHTML = Array(Math.min(count, 3))
      .fill()
      .map(
        () => `
      <div class="post-skeleton">
        <div class="post-skeleton__header">
          <div class="post-skeleton__avatar"></div>
          <div class="post-skeleton__info">
            <div class="post-skeleton__name"></div>
            <div class="post-skeleton__meta"></div>
          </div>
        </div>
        <div class="post-skeleton__content"></div>
        <div class="post-skeleton__actions">
          <div class="post-skeleton__action"></div>
          <div class="post-skeleton__action"></div>
          <div class="post-skeleton__action"></div>
        </div>
      </div>
    `
      )
      .join("");

    postsFeed.innerHTML = skeletonHTML;
  }

  hidePostsLoading() {
    // This method is called when renderPosts() runs
    // No explicit action needed as renderPosts() will replace the content
  }

  showPostsError() {
    const postsFeed = document.getElementById("postsFeed");
    if (!postsFeed) return;

    postsFeed.innerHTML = `
      <div class="posts-error">
        <div class="posts-error__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="posts-error__title">Failed to load posts</div>
        <div class="posts-error__text">There was an error loading the posts. Please try again.</div>
        <button class="btn btn--primary posts-error__retry" type="button" id="retryLoadPosts">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

//Fetch community header information
async function loadCommunityHeader() {
  try {
    const res = await fetch(
      "http://127.0.0.1:3000/api/community/community-info"
    );
    if (res.ok) {
      const data = await res.json();
      document.getElementById("communityTitle").textContent =
        data.CommunityName || "Community";
      document.getElementById("communityDescription").textContent =
        data.Description || "";

      // Get user from localStorage (works for both regular and Google auth)
      const currentUserRaw = localStorage.getItem("currentUser");
      const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;

      console.log("Current user for join button check:", currentUser);
      console.log("User ID:", currentUser?.id);
      console.log("User CommunityID:", currentUser?.CommunityID);

      const headerActions = document.getElementById("communityHeaderActions");
      const joinBtn = document.getElementById("joinCommunityBtn");

      // Check if user is logged in and has no CommunityID (null, undefined, or not set)
      if (
        currentUser &&
        currentUser.id &&
        (currentUser.CommunityID === null ||
          currentUser.CommunityID === undefined)
      ) {
        console.log("Showing join button for user:", currentUser.id);
        if (joinBtn) {
          joinBtn.style.display = "block";

          joinBtn.addEventListener("click", async () => {
            try {
              const response = await fetch(
                "http://127.0.0.1:3000/api/community/join",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    userId: currentUser.id, // Use the id from localStorage
                  }),
                }
              );

              if (response.ok) {
                const result = await response.json();
                window.communityManager.showNotification(
                  result.message || "Join request sent successfully",
                  "success"
                );
              } else {
                const error = await response.json();
                window.communityManager.showNotification(
                  error.error || "Failed to send join request",
                  "error"
                );
              }
            } catch (error) {
              console.error("Error joining community:", error);
              window.communityManager.showNotification(
                "Failed to send join request",
                "error"
              );
            }
          });
        }
      } else {
        // User is either not logged in or already in a community
        console.log(
          "Hiding join button. Reason:",
          !currentUser
            ? "No user logged in"
            : !currentUser.id
            ? "No user ID"
            : "User already in community (CommunityID: " +
              currentUser.CommunityID +
              ")"
        );
        if (joinBtn) joinBtn.style.display = "none";
      }

      // Show edit button only for admin
      if (
        currentUser &&
        currentUser.id &&
        data.AdminUserID &&
        currentUser.id === data.AdminUserID
      ) {
        console.log("User is admin, creating edit button...");
        console.log("Current user ID:", currentUser.id);
        console.log("Admin user ID:", data.AdminUserID);

        const editBtn = document.createElement("button");
        editBtn.className = "btn btn--primary btn--large";
        editBtn.id = "editCommunityBtn";
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Community';

        console.log("Edit button created:", editBtn);

        if (headerActions) {
          headerActions.appendChild(editBtn);
          console.log("Edit button added to header actions");

          // Setup modal events for the new edit button
          console.log("Setting up modal for edit button...");
          setupCommunityEditModal(editBtn, currentUser);
        } else {
          console.error("Header actions element not found");
        }
      } else {
        console.log("User is not admin or missing data:", {
          hasUser: !!currentUser,
          userId: currentUser?.id,
          adminId: data.AdminUserID,
          isMatch: currentUser?.id === data.AdminUserID,
        });
      }
    } else {
      console.error("Failed to fetch community info. Status:", res.status);
      document.getElementById("communityTitle").textContent = "Community";
      document.getElementById("communityDescription").textContent =
        "Unable to load description.";
    }
  } catch (e) {
    console.error("Error fetching community info:", e);
    document.getElementById("communityTitle").textContent = "Community";
    document.getElementById("communityDescription").textContent =
      "Unable to load description.";
  }
}

function setupCommunityEditModal(editButton, currentUser) {
  console.log("Setting up community edit modal...");

  const modal = document.getElementById("communityEditModal");
  const closeModal = document.getElementById("closeCommunityEdit");
  const saveBtn = document.getElementById("saveCommunityEdit");

  console.log("Modal elements found:", {
    modal: !!modal,
    closeModal: !!closeModal,
    saveBtn: !!saveBtn,
    editButton: !!editButton,
  });

  if (!modal) {
    console.error("Community edit modal not found in DOM");
    return;
  }

  // Show modal when edit button is clicked
  editButton.addEventListener("click", (e) => {
    console.log("Edit button clicked!");
    e.preventDefault();
    e.stopPropagation();

    // Fill modal with current info
    const communityName = document.getElementById("editCommunityName");
    const communityDesc = document.getElementById("editCommunityDesc");

    if (communityName) {
      communityName.value =
        document.getElementById("communityTitle").textContent;
    }
    if (communityDesc) {
      communityDesc.value = document.getElementById(
        "communityDescription"
      ).textContent;
    }

    console.log("Showing modal...");
    modal.classList.add("show");
  });

  // Close modal when X is clicked
  if (closeModal) {
    closeModal.addEventListener("click", () => {
      console.log("Close button clicked");
      modal.classList.remove("show");
    });
  } else {
    console.warn("Close modal button not found");
  }

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      console.log("Clicked outside modal, closing...");
      modal.classList.remove("show");
    }
  });

  // Save changes when save button is clicked
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      console.log("Save button clicked");

      const nameInput = document.getElementById("editCommunityName");
      const descInput = document.getElementById("editCommunityDesc");

      if (!nameInput || !descInput) {
        console.error("Input fields not found");
        return;
      }

      const name = nameInput.value.trim();
      const description = descInput.value.trim();

      if (!name) {
        if (window.communityManager) {
          window.communityManager.showNotification(
            "Community name cannot be empty",
            "warning"
          );
        } else {
          alert("Community name cannot be empty");
        }
        return;
      }

      // Disable save button during request
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        const res = await fetch(
          "http://127.0.0.1:3000/api/community/community-info",
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              name,
              description,
              userId: currentUser.id, // Send user ID for verification
            }),
          }
        );

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error || "Failed to update community info");
        }

        // Update UI with new values
        const titleElement = document.getElementById("communityTitle");
        const descElement = document.getElementById("communityDescription");

        if (titleElement) titleElement.textContent = name;
        if (descElement) descElement.textContent = description;

        console.log("Community update successful, showing notification...");
        if (window.communityManager) {
          console.log("CommunityManager available, calling showNotification");
          window.communityManager.showNotification(
            "Community info updated successfully!",
            "success",
            2000
          );
        } else {
          console.error("CommunityManager not available on window object");
        }

        modal.classList.remove("show");
      } catch (error) {
        console.error("Update error:", error);
        if (window.communityManager) {
          window.communityManager.showNotification(
            error.message || "Error updating community info",
            "error"
          );
        } else {
          alert("Error updating community info: " + error.message);
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    });
  } else {
    console.warn("Save button not found");
  }
}

//Fetch and display posts count
async function updatePostsCount() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/posts");
    if (res.ok) {
      const posts = await res.json();
      console.log("Fetched posts:", posts.length);
      const postsCountElem = document.getElementById("postsCount");
      if (postsCountElem) {
        postsCountElem.textContent = posts.length;
      }
    } else {
      console.error("Failed to fetch posts count. Status:", res.status);
    }
  } catch (e) {
    console.error("Error fetching posts count:", e);
  }
}

//Fetch and display members count
async function updateMembersCount() {
  try {
    const res = await fetch(
      "http://localhost:3000/api/community/members-count"
    );
    if (res.ok) {
      const data = await res.json();
      const membersCountElem = document.getElementById("membersCount");
      if (membersCountElem) {
        membersCountElem.textContent = data.count;
      }
    } else {
      console.error("Failed to fetch members count. Status:", res.status);
    }
  } catch (e) {
    console.error("Error fetching members count:", e);
  }
}

// Initialize community manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Prevent multiple instances
  if (window.communityManager) {
    console.log("CommunityManager already exists, skipping initialization");
    return;
  }

  // Add a small delay to ensure all components are loaded
  setTimeout(() => {
    loadCommunityHeader();
    updatePostsCount();
    updateMembersCount();
    window.communityManager = new CommunityManager();
    console.log("CommunityManager initialized successfully");
  }, 100);
});
