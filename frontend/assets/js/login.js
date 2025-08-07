// Login Page JavaScript - Enhanced version of auth.js for login.html

class LoginPageManager {
  constructor() {
    this.currentForm = "login";
    this.isLoading = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Form pill toggles
    const formPills = document.querySelectorAll(".form-pill");
    formPills.forEach((pill) => {
      pill.addEventListener("click", (e) => {
        const formType = e.target.closest(".form-pill").dataset.form;
        this.switchForm(formType);
      });
    });

    // Switch button in footer
    const switchBtn = document.getElementById("switchBtn");
    if (switchBtn) {
      switchBtn.addEventListener("click", () => {
        const newForm = this.currentForm === "login" ? "signup" : "login";
        this.switchForm(newForm);
      });
    }

    // Password toggle buttons
    const passwordToggles = document.querySelectorAll(".password-toggle");
    passwordToggles.forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        const targetId = e.target.closest(".password-toggle").dataset.target;
        this.togglePasswordVisibility(targetId);
      });
    });

    // Form submissions
    const loginForm = document.getElementById("loginFormElement");
    const signupForm = document.getElementById("signupFormElement");

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin(e.target);
      });
    }

    if (signupForm) {
      signupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSignup(e.target);
      });
    }

    // Input focus animations
    this.setupInputAnimations();
  }

  setupInputAnimations() {
    const inputs = document.querySelectorAll(".form-input");
    inputs.forEach((input) => {
      input.addEventListener("focus", () => {
        input.parentElement.classList.add("focused");
      });

      input.addEventListener("blur", () => {
        if (!input.value) {
          input.parentElement.classList.remove("focused");
        }
      });

      // Check if input has value on load
      if (input.value) {
        input.parentElement.classList.add("focused");
      }
    });
  }

  switchForm(formType) {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const formPills = document.querySelectorAll(".form-pill");
    const authTitle = document.getElementById("authTitle");
    const authSubtitle = document.getElementById("authSubtitle");
    const switchQuestion = document.getElementById("switchQuestion");
    const switchBtn = document.getElementById("switchBtn");

    // Update active states
    formPills.forEach((pill) => pill.classList.remove("form-pill--active"));
    document
      .querySelector(`[data-form="${formType}"]`)
      .classList.add("form-pill--active");

    // Switch forms with animation
    if (formType === "login") {
      signupForm.classList.remove("auth-form--active");
      setTimeout(() => {
        loginForm.classList.add("auth-form--active");
      }, 200);

      // Update text content
      authTitle.textContent = "Welcome Back";
      authSubtitle.textContent = "Sign in to your MConnect account";
      switchQuestion.textContent = "Don't have an account?";
      switchBtn.textContent = "Sign up";
    } else {
      loginForm.classList.remove("auth-form--active");
      setTimeout(() => {
        signupForm.classList.add("auth-form--active");
      }, 200);

      // Update text content
      authTitle.textContent = "Join MConnect";
      authSubtitle.textContent = "Create your account to get started";
      switchQuestion.textContent = "Already have an account?";
      switchBtn.textContent = "Sign in";
    }

    this.currentForm = formType;
    this.clearFormErrors();
  }

  togglePasswordVisibility(targetId) {
    const input = document.getElementById(targetId);
    const toggle = document.querySelector(`[data-target="${targetId}"]`);
    const icon = toggle.querySelector("i");

    if (input.type === "password") {
      input.type = "text";
      icon.className = "fas fa-eye-slash";
    } else {
      input.type = "password";
      icon.className = "fas fa-eye";
    }
  }

  showFieldError(input, message) {
    const errorElement =
      document.getElementById(`${input.id}Error`) ||
      document.getElementById(`${input.name}Error`);

    if (errorElement) {
      errorElement.textContent = message;
    }

    input.classList.add("error");
    input.classList.remove("success");
    input.parentElement.classList.remove("success");
  }

  showFieldSuccess(input) {
    const errorElement =
      document.getElementById(`${input.id}Error`) ||
      document.getElementById(`${input.name}Error`);

    if (errorElement) {
      errorElement.textContent = "";
    }

    input.classList.add("success");
    input.classList.remove("error");
    input.parentElement.classList.add("success");
  }

  clearFieldError(input) {
    const errorElement =
      document.getElementById(`${input.id}Error`) ||
      document.getElementById(`${input.name}Error`);

    if (errorElement && errorElement.textContent) {
      errorElement.textContent = "";
      input.classList.remove("error", "success");
      input.parentElement.classList.remove("success");
    }
  }

  clearFormErrors() {
    const errorElements = document.querySelectorAll(".input-error");
    errorElements.forEach((error) => (error.textContent = ""));

    const inputs = document.querySelectorAll(".form-input");
    inputs.forEach((input) => {
      input.classList.remove("error", "success");
      input.parentElement.classList.remove("success");
    });
  }

  async handleLogin(form) {
    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: document.getElementById("loginEmail").value,
          password: document.getElementById("loginPassword").value,
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Login failed" }));
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();
      // Clear logout flag since user is logging in
      sessionStorage.removeItem("userLoggedOut");
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      window.location.href = "community.html";
    } catch (error) {
      console.error("Login error:", error);
      this.showNotification(error.message || "Connection failed", "error");
    }
  }

  async handleSignup(form) {
    if (this.isLoading) return;

    const formData = new FormData(form);

    // Show loading state
    this.setLoadingState(true, "signupFormElement");

    try {
      // Simulate API call
      await this.simulateApiCall(3000);

      // Success
      this.showNotification(
        "Account created successfully! Welcome to MConnect!",
        "success"
      );

      // Redirect after delay
      setTimeout(() => {
        window.location.href = "community.html";
      }, 2000);
    } catch (error) {
      this.showNotification(
        "An error occurred during registration. Please try again.",
        "error"
      );
    } finally {
      this.setLoadingState(false, "signupFormElement");
    }
  }

  setLoadingState(loading, formId) {
    this.isLoading = loading;
    const form = document.getElementById(formId);
    const submitBtn = form.querySelector('[type="submit"]');

    if (loading) {
      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      form.classList.add("loading");
    } else {
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
      form.classList.remove("loading");
    }
  }

  async simulateApiCall(delay = 1000) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 95% success rate
        if (Math.random() > 0.05) {
          resolve("Success");
        } else {
          reject(new Error("API Error"));
        }
      }, delay);
    });
  }

  showNotification(message, type = "info") {
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
            : "info-circle"
        }"></i>
        <span>${message}</span>
      </div>
      <button class="notification__close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialize login page manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.loginPageManager = new LoginPageManager();
});
