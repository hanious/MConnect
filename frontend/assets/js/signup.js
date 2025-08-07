class SignupManager {
  constructor() {
    this.isLoading = false;
    this.validationErrors = []; // Array to track all validation errors
    this.init();
  }

  // Utility function to convert option values to proper display format
  formatSelectOptionToDisplay(optionValue) {
    if (!optionValue || typeof optionValue !== "string") {
      return "";
    }

    return optionValue
      .split("-") // Split by hyphen
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" "); // Join with spaces
  }

  // Utility function to sanitize text input with proper capitalization
  sanitizeDisplayText(input) {
    if (!input || typeof input !== "string") {
      return "";
    }

    return input
      .trim() // Remove leading/trailing whitespace
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .split(" ") // Split into words
      .map((word) => {
        // Capitalize first letter of each word, make rest lowercase
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" "); // Join words back together
  }

  init() {
    this.setupEventListeners();
    this.setupFormValidation();
    this.setupPasswordStrength();
    this.setupPasswordMatch();
  }

  // Add error to validation errors array
  addValidationError(fieldId, errorMessage) {
    // Remove existing error for this field first
    this.validationErrors = this.validationErrors.filter(
      (error) => error.fieldId !== fieldId
    );

    // Add new error
    this.validationErrors.push({
      fieldId: fieldId,
      message: errorMessage,
    });
  }

  // Remove error from validation errors array
  removeValidationError(fieldId) {
    this.validationErrors = this.validationErrors.filter(
      (error) => error.fieldId !== fieldId
    );
  }

  // Check if field has validation error
  hasValidationError(fieldId) {
    return this.validationErrors.some((error) => error.fieldId === fieldId);
  }

  // Clear all validation errors
  clearAllValidationErrors() {
    this.validationErrors = [];
  }

  // Apply all errors to UI
  applyValidationErrors() {
    // Clear all existing errors first
    this.clearFormErrors();

    // Apply each error in the array
    this.validationErrors.forEach((error) => {
      const input = document.getElementById(error.fieldId);
      if (input) {
        if (input.type === "checkbox") {
          this.showCheckboxError(input, error.message);
        } else {
          this.showFieldError(input, error.message);
        }
      }
    });
  }

  setupEventListeners() {
    // Password toggle buttons
    document.querySelectorAll(".password-toggle").forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        const targetId = e.currentTarget.dataset.target;
        this.togglePasswordVisibility(targetId);
      });
    });

    // Form submission
    const form = document.getElementById("signupFormElement");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleSignup();
      });
    }

    this.setupInputAnimations();
  }

  setupInputAnimations() {
    document.querySelectorAll(".form-input").forEach((input) => {
      input.addEventListener("focus", () => {
        input.parentElement.classList.add("focused");
      });

      input.addEventListener("blur", () => {
        if (!input.value) {
          input.parentElement.classList.remove("focused");
        }
      });

      // Initialize focused state for pre-filled values
      if (input.value) {
        input.parentElement.classList.add("focused");
      }
    });
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

  setupFormValidation() {
    // Real-time validation for input fields
    document.querySelectorAll(".form-input").forEach((input) => {
      input.addEventListener("input", () => {
        // Remove error from array and clear UI error if field becomes valid
        if (this.hasValidationError(input.id)) {
          this.validateField(input);
          if (this.isFieldValid(input)) {
            this.removeValidationError(input.id);
            this.clearFieldError(input);
          }
        } else {
          // Normal real-time validation
          this.validateField(input);
        }
      });

      input.addEventListener("blur", () => {
        // Validate on blur to catch any missed errors
        this.validateField(input);
      });
    });

    // Clear checkbox error when user checks the terms
    const agreeTermsCheckbox = document.getElementById("agreeTerms");
    if (agreeTermsCheckbox) {
      agreeTermsCheckbox.addEventListener("change", () => {
        if (
          agreeTermsCheckbox.checked &&
          this.hasValidationError("agreeTerms")
        ) {
          this.removeValidationError("agreeTerms");
          this.clearCheckboxError(agreeTermsCheckbox);
        }
      });
    }
  }

  // Helper method to check if a field is currently valid
  isFieldValid(input) {
    const value = input.value.trim();

    // Required field check
    if (input.hasAttribute("required") && !value) {
      return false;
    }

    // Select validation
    if (
      input.tagName === "SELECT" &&
      input.hasAttribute("required") &&
      !value
    ) {
      return false;
    }

    // Email validation
    if (input.type === "email" && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return false;
      }
    }

    // Password validation
    if (input.type === "password" && input.id === "signupPassword" && value) {
      if (
        value.length < 8 ||
        !/[a-z]/.test(value) ||
        !/[A-Z]/.test(value) ||
        !/\d/.test(value)
      ) {
        return false;
      }
    }

    return true;
  }

  setupPasswordStrength() {
    const passwordInput = document.getElementById("signupPassword");
    if (passwordInput) {
      passwordInput.addEventListener("input", () => {
        this.updatePasswordStrength(passwordInput.value);
      });
    }
  }

  setupPasswordMatch() {
    const password = document.getElementById("signupPassword");
    const confirmPassword = document.getElementById("confirmPassword");

    if (password && confirmPassword) {
      const checkPasswordMatch = () => {
        if (password.value && confirmPassword.value) {
          if (password.value !== confirmPassword.value) {
            if (this.hasValidationError("confirmPassword")) {
              // Error already shown, keep it
            } else {
              // Show error in real-time
              this.showFieldError(confirmPassword, "Passwords do not match");
            }
          } else {
            // Passwords match, clear any errors
            if (this.hasValidationError("confirmPassword")) {
              this.removeValidationError("confirmPassword");
            }
            this.clearFieldError(confirmPassword);
            this.showFieldSuccess(confirmPassword);
          }
        }
      };

      confirmPassword.addEventListener("input", checkPasswordMatch);
      password.addEventListener("input", () => {
        if (confirmPassword.value) {
          checkPasswordMatch();
        }
      });
    }
  }

  validateField(input) {
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = "";

    // Required field validation (check this first)
    if (input.hasAttribute("required") && !value) {
      const fieldName = input.placeholder || "This field";
      errorMessage = `${fieldName} is required`;
      isValid = false;
    }
    // Select validation for dropdowns
    else if (
      input.tagName === "SELECT" &&
      input.hasAttribute("required") &&
      !value
    ) {
      errorMessage = "Please select an option";
      isValid = false;
    }
    // Email validation (only if field has value)
    else if (input.type === "email" && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errorMessage = "Please enter a valid email address";
        isValid = false;
      }
    }
    // Password validation (only if field has value)
    else if (
      input.type === "password" &&
      input.id === "signupPassword" &&
      value
    ) {
      const errors = [];

      if (value.length < 8) {
        errors.push("at least 8 characters");
      }
      if (!/[a-z]/.test(value)) {
        errors.push("one lowercase letter");
      }
      if (!/[A-Z]/.test(value)) {
        errors.push("one uppercase letter");
      }
      if (!/\d/.test(value)) {
        errors.push("one number");
      }

      if (errors.length > 0) {
        errorMessage = `Password must contain ${errors.join(", ")}`;
        isValid = false;
      }
    }

    // Show validation result
    if (!isValid && errorMessage) {
      this.showFieldError(input, errorMessage);
    } else if (isValid && value) {
      this.showFieldSuccess(input);
    }

    return isValid;
  }

  // Validation method specifically for form submission (adds to error array)
  validateFieldForSubmission(input) {
    const value = input.value.trim();
    let errorMessage = "";

    // Required field validation (check this first)
    if (input.hasAttribute("required") && !value) {
      const fieldName = input.placeholder || "This field";
      errorMessage = `${fieldName} is required`;
    }
    // Select validation for dropdowns
    else if (
      input.tagName === "SELECT" &&
      input.hasAttribute("required") &&
      !value
    ) {
      errorMessage = "Please select an option";
    }
    // Only validate format if field has value and is not empty
    else if (value) {
      // Email validation (only if field has value)
      if (input.type === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errorMessage = "Please enter a valid email address";
        }
      }
      // Password validation (only if field has value)
      else if (input.type === "password" && input.id === "signupPassword") {
        const errors = [];

        if (value.length < 8) {
          errors.push("at least 8 characters");
        }
        if (!/[a-z]/.test(value)) {
          errors.push("one lowercase letter");
        }
        if (!/[A-Z]/.test(value)) {
          errors.push("one uppercase letter");
        }
        if (!/\d/.test(value)) {
          errors.push("one number");
        }

        if (errors.length > 0) {
          errorMessage = `Password must contain ${errors.join(", ")}`;
        }
      }
    }

    // Add error to array if validation failed
    if (errorMessage) {
      this.addValidationError(input.id, errorMessage);
    }
  }

  // Password match validation for submission
  validatePasswordMatchForSubmission() {
    const password = document.getElementById("signupPassword");
    const confirmPassword = document.getElementById("confirmPassword");

    // Only check password match if both fields have values
    if (
      password &&
      confirmPassword &&
      password.value &&
      confirmPassword.value
    ) {
      if (password.value !== confirmPassword.value) {
        this.addValidationError("confirmPassword", "Passwords do not match");
      }
    }
    // If confirm password is empty but required, the field validation will catch it
    // If password is empty but required, the field validation will catch it
  }

  // Terms validation for submission
  validateTermsForSubmission() {
    const agreeTerms = document.getElementById("agreeTerms");

    if (!agreeTerms || !agreeTerms.checked) {
      this.addValidationError(
        "agreeTerms",
        "You must agree to the Terms of Service and Privacy Policy to continue"
      );
    }
  }

  validatePasswordMatch() {
    const password = document.getElementById("signupPassword");
    const confirmPassword = document.getElementById("confirmPassword");

    if (
      password &&
      confirmPassword &&
      password.value &&
      confirmPassword.value
    ) {
      if (password.value !== confirmPassword.value) {
        this.showFieldError(confirmPassword, "Passwords do not match");
        return false;
      } else {
        this.showFieldSuccess(confirmPassword);
        return true;
      }
    }
    return true;
  }

  validateTermsAgreement() {
    const agreeTerms = document.getElementById("agreeTerms");

    if (!agreeTerms) {
      return false;
    }

    if (!agreeTerms.checked) {
      this.showCheckboxError(
        agreeTerms,
        "You must agree to the Terms of Service and Privacy Policy to continue"
      );
      return false;
    } else {
      this.clearCheckboxError(agreeTerms);
      return true;
    }
  }

  validateAllFields() {
    // Clear the error array and UI
    this.clearAllValidationErrors();
    this.clearFormErrors();

    const requiredFields = [
      "firstName",
      "lastName",
      "signupEmail",
      "company",
      "jobTitle",
      "industry",
      "signupPassword",
      "confirmPassword",
    ];

    // Validate all required fields and collect errors
    requiredFields.forEach((fieldId) => {
      const input = document.getElementById(fieldId);
      if (input) {
        this.validateFieldForSubmission(input);
      }
    });

    // Validate password match
    this.validatePasswordMatchForSubmission();

    // Validate terms checkbox
    this.validateTermsForSubmission();

    // Apply all collected errors to the UI
    this.applyValidationErrors();

    // Return true if no errors exist
    return this.validationErrors.length === 0;
  }

  updatePasswordStrength(password) {
    const strengthFill = document.querySelector(".strength-fill");
    const strengthText = document.querySelector(".strength-text");

    if (!strengthFill || !strengthText) return;

    if (!password) {
      strengthFill.className = "strength-fill";
      strengthText.textContent = "Password strength";
      return;
    }

    let score = 0;

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;

    // Update UI
    if (score <= 2) {
      strengthFill.className = "strength-fill weak";
      strengthText.textContent = "Weak password";
    } else if (score <= 3) {
      strengthFill.className = "strength-fill fair";
      strengthText.textContent = "Fair password";
    } else if (score <= 4) {
      strengthFill.className = "strength-fill good";
      strengthText.textContent = "Good password";
    } else {
      strengthFill.className = "strength-fill strong";
      strengthText.textContent = "Strong password";
    }
  }

  showFieldError(input, message) {
    // Find or create error element
    let errorElement =
      document.getElementById(`${input.id}Error`) ||
      document.getElementById(`${input.name}Error`);

    if (!errorElement) {
      // Create error element if it doesn't exist
      errorElement = document.createElement("div");
      errorElement.id = `${input.id}Error`;
      errorElement.className = "input-error";
      input.parentElement.parentElement.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = "flex";

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
      errorElement.style.display = "none";
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
      errorElement.style.display = "none";
      input.classList.remove("error", "success");
      input.parentElement.classList.remove("success");
    }
  }

  showCheckboxError(checkbox, message) {
    const errorElement = document.getElementById(`${checkbox.id}Error`);

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "flex";
      errorElement.classList.add("show");
    }

    // Add error styling to checkbox wrapper
    const checkboxWrapper = checkbox.closest(".checkbox-wrapper");
    if (checkboxWrapper) {
      checkboxWrapper.classList.add("error");
    }
  }

  clearCheckboxError(checkbox) {
    const errorElement = document.getElementById(`${checkbox.id}Error`);

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
      errorElement.classList.remove("show");
    }

    // Remove error styling from checkbox wrapper
    const checkboxWrapper = checkbox.closest(".checkbox-wrapper");
    if (checkboxWrapper) {
      checkboxWrapper.classList.remove("error");
    }
  }

  clearFormErrors() {
    document.querySelectorAll(".input-error").forEach((error) => {
      error.textContent = "";
      error.style.display = "none";
      error.classList.remove("show");
    });

    document.querySelectorAll(".form-input").forEach((input) => {
      input.classList.remove("error", "success");
      input.parentElement.classList.remove("success");
    });

    // Clear checkbox errors
    document.querySelectorAll(".checkbox-wrapper").forEach((wrapper) => {
      wrapper.classList.remove("error");
    });
  }

  async handleSignup() {
    if (this.isLoading) return;

    // Validate all fields and collect errors
    if (!this.validateAllFields()) {
      // Show notification with error count
      const errorCount = this.validationErrors.length;
      const errorText = errorCount === 1 ? "error" : "errors";
      this.showNotification(
        `Please fix ${errorCount} ${errorText} below`,
        "error"
      );
      return;
    }

    // Prepare form data
    const jobTitleValue = document.getElementById("jobTitle").value;
    const industryValue = document.getElementById("industry").value;

    const formData = {
      firstName: this.sanitizeDisplayText(
        document.getElementById("firstName").value
      ),
      lastName: this.sanitizeDisplayText(
        document.getElementById("lastName").value
      ),
      email: document.getElementById("signupEmail").value.trim().toLowerCase(),
      password: document.getElementById("signupPassword").value,
      company: this.sanitizeDisplayText(
        document.getElementById("company").value
      ),
      jobTitle:
        jobTitleValue === "other"
          ? "Other"
          : this.formatSelectOptionToDisplay(jobTitleValue),
      industry:
        industryValue === "other"
          ? "Other"
          : this.formatSelectOptionToDisplay(industryValue),
      subscribeNewsletter:
        document.getElementById("subscribeNewsletter")?.checked || false,
    };

    this.setLoadingState(true);

    try {
      // Send data to backend
      const response = await fetch("http://127.0.0.1:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      // Success - show notification and redirect
      console.log(
        "Signup successful! Showing notification and setting redirect..."
      );
      this.showNotification(
        "Account created successfully! Please sign in to continue.",
        "success"
      );

      // Redirect after delay
      setTimeout(() => {
        console.log("Executing redirect to login.html...");
        window.location.href = "login.html";
      }, 5000);
    } catch (error) {
      console.error("Signup error:", error);
      this.showNotification(
        error.message || "An error occurred. Please try again.",
        "error"
      );
    } finally {
      this.setLoadingState(false);
    }
  }

  setLoadingState(loading) {
    this.isLoading = loading;
    const form = document.getElementById("signupFormElement");
    const submitBtn = form?.querySelector('[type="submit"]');

    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading
        ? '<i class="fas fa-spinner fa-spin"></i> Processing...'
        : '<i class="fas fa-user-plus"></i> Create Account';
    }
  }

  showNotification(message, type = "info") {
    // Remove existing notifications
    document.querySelectorAll(".notification").forEach((n) => n.remove());

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
      <button class="notification__close">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add click handler for close button
    notification
      .querySelector(".notification__close")
      .addEventListener("click", () => {
        notification.remove();
      });

    // Add to page and auto-remove after 3 seconds
    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 3000);
  }

  injectStyles() {
    // Styles moved to SCSS: signup-form.scss
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SignupManager();
});
