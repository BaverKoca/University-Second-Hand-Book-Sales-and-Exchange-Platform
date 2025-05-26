// Session management utility
class SessionManager {
  constructor() {
    this.timeoutDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.timeoutId = null;
    this.publicPages = ['index.html', 'login.html', 'register.html'];
    this.setupEventListeners();
    this.checkSession();
  }

  setupEventListeners() {
    // Reset timer on user activity
    document.addEventListener('mousemove', () => this.resetTimer());
    document.addEventListener('click', () => this.resetTimer());
    document.addEventListener('keypress', () => this.resetTimer());
    document.addEventListener('scroll', () => this.resetTimer());

    // Handle page load
    window.addEventListener('load', () => this.checkSession());
  }

  resetTimer() {
    if (!localStorage.getItem('rememberMe')) {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = setTimeout(() => this.endSession(), this.timeoutDuration);
    }
  }

  isPublicPage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    return this.publicPages.includes(currentPage);
  }

  checkSession() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const currentUser = localStorage.getItem('currentUser');
    const rememberMe = localStorage.getItem('rememberMe');
    
    // Allow access to public pages even without login
    if (this.isPublicPage()) {
      // If user is logged in and tries to access login/register, redirect to home
      if (isLoggedIn && currentUser) {
        window.location.href = 'home.html';
      }
      return;
    }

    // For protected pages, check authentication
    if (!isLoggedIn || !currentUser) {
      this.endSession();
      return;
    }

    // Reset the timer only if remember me is not enabled
    if (!rememberMe) {
      this.resetTimer();
    }
  }

  endSession() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('favoriteBooks');
    localStorage.removeItem('rememberMe');
    
    // Only redirect if not already on a public page
    if (!this.isPublicPage()) {
      window.location.href = 'index.html';
    }
  }

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser'));
    } catch {
      this.endSession();
      return null;
    }
  }

  setRememberMe(enabled) {
    if (enabled) {
      localStorage.setItem('rememberMe', 'true');
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    } else {
      localStorage.removeItem('rememberMe');
      this.resetTimer();
    }
  }
}

// Create global session manager instance
const sessionManager = new SessionManager();

// Handle sign out
document.addEventListener('DOMContentLoaded', () => {
  const signOutLinks = document.querySelectorAll('a[href="index.html"]');
  signOutLinks.forEach(link => {
    if (link.textContent.includes('Sign Out')) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        sessionManager.endSession();
      });
    }
  });
}); 