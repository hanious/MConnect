// Utility to load HTML components into a placeholder element
function loadComponent(selector, url, callback) {
  fetch(url)
    .then((response) => response.text())
    .then((html) => {
      document.querySelector(selector).innerHTML = html;

      // Set active navigation links after component loads
      setActiveNavLink();

      // Execute callback if provided
      if (typeof callback === "function") callback();
    })
    .catch((error) => {
      console.error("Error loading component:", error);
    });
}

// Global function to set active navigation links
function setActiveNavLink() {
  const navLinks = document.querySelectorAll(".nav-link");
  const currentPath = window.location.pathname.split("/").pop();

  navLinks.forEach((link) => {
    const linkPath = link.getAttribute("href");
    if (
      linkPath === currentPath ||
      (linkPath === "index.html" && (currentPath === "" || currentPath === "/"))
    ) {
      link.classList.add("nav-link--active");
    } else {
      link.classList.remove("nav-link--active");
    }
  });
}

// Make setActiveNavLink globally available
window.setActiveNavLink = setActiveNavLink;

document.addEventListener("DOMContentLoaded", function () {
  const headerPlaceholder = document.getElementById("header-placeholder");
  if (headerPlaceholder) {
    loadComponent(
      "#header-placeholder",
      "/frontend/components/header.html",
      function () {
        // Initialize header manager after header component loads
        if (window.headerManager) {
          window.headerManager.refreshUserData();
        } else {
          // Wait a bit for headerManager to be available
          setTimeout(() => {
            if (window.headerManager) {
              window.headerManager.refreshUserData();
            }
          }, 100);
        }
      }
    );
  }
});
