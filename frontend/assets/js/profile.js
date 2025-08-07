class ProfileManager {
  constructor() {
    this.currentUser = null;
    this.headerManager = window.headerManager;
    this.init();
  }

  init() {
    this.setupHeaderManager();
    this.loadUserData();
    this.setupEventListeners();
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
          this.updateAvatarPreview();
        }
      }, 100);
    }
  }

  async loadUserData() {
    // Always fetch user data from localStorage
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    this.currentUser = user;

    // Populate form fields (support both camelCase and PascalCase)
    document.getElementById("firstName").value =
      user.firstName || user.FirstName || "";
    document.getElementById("lastName").value =
      user.lastName || user.LastName || "";
    // Set jobTitle select value (convert display to value if needed)
    const jobTitleSelect = document.getElementById("jobTitle");
    const companyInput = document.getElementById("company");
    const industrySelect = document.getElementById("industry");

    // Helper to map display text to value
    function getJobTitleValue(display) {
      const map = {
        "Operations Manager": "operations-manager",
        "Senior Engineer": "senior-engineer",
        "Safety Coordinator": "safety-coordinator",
        "Project Manager": "project-manager",
        "Field Supervisor": "field-supervisor",
        "Technical Specialist": "technical-specialist",
        Other: "other",
      };
      return map[display] || display || "";
    }
    function getIndustryValue(display) {
      const map = {
        "Mining & Minerals": "mining",
        "Oil & Gas": "oil-gas",
        "Renewable Energy": "renewable-energy",
        Utilities: "utilities",
        Construction: "construction",
        Other: "other",
      };
      return map[display] || display || "";
    }

    // Set values
    jobTitleSelect.value = getJobTitleValue(
      user.jobTitle || user.JobTitle || ""
    );
    companyInput.value = user.company || user.Company || "";
    industrySelect.value = getIndustryValue(
      user.industry || user.Industry || ""
    );

    // Load avatar if available
    this.loadUserAvatar();

    // Update avatar preview
    this.updateAvatarPreview();
  }

  async loadUserAvatar() {
    const userId = this.currentUser.id || this.currentUser.UserID;
    const avatarPath = this.currentUser.AvatarPath || this.currentUser.avatarPath;
    
    if (avatarPath) {
      try {
        const response = await fetch(`http://localhost:3000/api/users/${userId}/avatar`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          
          const avatarPreview = document.querySelector(".avatar-preview");
          if (avatarPreview) {
            avatarPreview.innerHTML = `<img src="${imageUrl}" alt="Profile Avatar">`;
          }
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
        // If avatar fails to load, show initials as fallback
        this.updateAvatarPreview();
      }
    }
  }

  updateAvatarPreview() {
    const avatarPreview = document.querySelector(".avatar-initials");
    if (!avatarPreview) return;

    // Support both camelCase and PascalCase
    const firstName =
      this.currentUser.firstName || this.currentUser.FirstName || "";
    const lastName =
      this.currentUser.lastName || this.currentUser.LastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const initials = this.headerManager
      ? this.headerManager.getUserInitials(fullName)
      : this.getInitials(fullName);

    avatarPreview.textContent = initials;
  }

  getInitials(name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  setupEventListeners() {
    const form = document.getElementById("profileForm");
    const cancelButton = document.getElementById("cancelButton");
    const avatarInput = document.getElementById("avatarInput");

    if (form) {
      form.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", () => this.handleCancel());
    }

    if (avatarInput) {
      avatarInput.addEventListener("change", (e) => this.handleAvatarChange(e));
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const formData = {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      jobTitle: document.getElementById("jobTitle").value,
      company: document.getElementById("company").value.trim(),
      industry: document.getElementById("industry").value,
    };

    // Validate form data
    if (!this.validateForm(formData)) {
      return;
    }

    try {
      // Use id or UserID for API call
      const userId = this.currentUser.id || this.currentUser.UserID;
      const response = await fetch(
        `http://localhost:3000/api/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            jobTitle: formData.jobTitle,
            company: formData.company,
            industry: formData.industry,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      // Update local storage with new user data (support both styles)
      const updatedUser = {
        ...this.currentUser,
        FirstName: formData.firstName,
        LastName: formData.lastName,
        JobTitle: formData.jobTitle,
        Company: formData.company,
        Industry: formData.industry,
        firstName: formData.firstName,
        lastName: formData.lastName,
        jobTitle: formData.jobTitle,
        company: formData.company,
        industry: formData.industry,
      };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));

      this.showNotification("Profile updated successfully!", "success");
      setTimeout(() => {
        window.location.href = "/frontend/pages/community.html";
      }, 1500);
    } catch (error) {
      console.error("Profile update error:", error);
      this.showNotification(
        error.message || "Failed to update profile",
        "error"
      );
    }
  }

  // All fields optional for profile update
  validateForm(formData) {
    return true;
  }

  handleCancel() {
    window.location.href = "/frontend/pages/community.html";
  }

  handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    console.log("File selected:", file.name, file.type, file.size);

    if (!file.type.startsWith("image/")) {
      this.showNotification("Please select an image file", "error");
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      this.showNotification("File size must be less than 5MB", "error");
      return;
    }

    // Show loading state
    this.showNotification("Uploading avatar...", "info");

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('avatar', file);

    console.log("FormData created, uploading to server...");

    // Upload to server
    const userId = this.currentUser.id || this.currentUser.UserID;
    console.log("Upload URL:", `http://localhost:3000/api/users/${userId}/avatar`);
    
    fetch(`http://localhost:3000/api/users/${userId}/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    .then(response => {
      console.log("Upload response status:", response.status);
      console.log("Upload response headers:", response.headers);
      
      if (!response.ok) {
        return response.text().then(text => {
          console.error("Upload failed with response:", text);
          throw new Error(`Upload failed: ${response.status} - ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      console.log("Upload successful:", data);
      
      // Update preview with uploaded image
      const reader = new FileReader();
      reader.onload = (e) => {
        const avatarPreview = document.querySelector(".avatar-preview");
        if (avatarPreview) {
          avatarPreview.innerHTML = `<img src="${e.target.result}" alt="Profile Avatar">`;
        }
      };
      reader.readAsDataURL(file);

      // Update current user data with avatar path
      this.currentUser.AvatarPath = data.avatarPath;
      this.currentUser.avatarPath = data.avatarPath;
      localStorage.setItem("currentUser", JSON.stringify(this.currentUser));

      this.showNotification("Avatar uploaded successfully!", "success");
    })
    .catch(error => {
      console.error('Avatar upload error:', error);
      this.showNotification(
        error.message || "Failed to upload avatar",
        "error"
      );
    });
  }

  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification notification--${type}`;
    notification.innerHTML = `
            <div class="notification__content">
                <i class="notification__icon fas ${this.getNotificationIcon(
                  type
                )}"></i>
                <span class="notification__message">${message}</span>
            </div>
        `;

    // Add to document
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add("notification--visible"), 100);

    // Remove after delay
    setTimeout(() => {
      notification.classList.remove("notification--visible");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  getNotificationIcon(type) {
    switch (type) {
      case "success":
        return "fa-check-circle";
      case "error":
        return "fa-exclamation-circle";
      case "warning":
        return "fa-exclamation-triangle";
      default:
        return "fa-info-circle";
    }
  }
}

// Initialize profile manager
window.addEventListener("DOMContentLoaded", () => {
  window.profileManager = new ProfileManager();
});
