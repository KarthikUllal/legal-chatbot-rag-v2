// Admin Login JavaScript

const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Simple frontend authentication
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin'
};

// Check if already logged in
if (sessionStorage.getItem('adminAuthenticated') === 'true' ||
    localStorage.getItem('adminAuthenticated') === 'true') {
    window.location.href = 'admin.html';
}

loginForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Show loading state
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    loginBtn.disabled = true;
    hideError();

    // Simple authentication check
    setTimeout(() => {
        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            // Use sessionStorage for auto-expiry when browser closes
            sessionStorage.setItem('adminAuthenticated', 'true');

            // Optional: Add timestamp for session management
            localStorage.setItem('authTimestamp', Date.now().toString());

            // Add success log
            console.log('✅ Admin login successful');

            // Redirect to admin dashboard
            window.location.href = 'admin.html';
        } else {
            showError('Invalid username or password. Please try again.');
            resetLoginButton();
        }
    }, 1000);
});

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // Add shake animation
    errorMessage.style.animation = 'none';
    errorMessage.offsetHeight; // Trigger reflow
    errorMessage.style.animation = 'shake 0.5s ease-in-out';
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function resetLoginButton() {
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    loginBtn.disabled = false;
}

// Clear error when user starts typing
document.getElementById('username').addEventListener('input', hideError);
document.getElementById('password').addEventListener('input', hideError);

// Prevent back button after logout
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        // Page was loaded from cache (back button)
        if (sessionStorage.getItem('adminAuthenticated') !== 'true') {
            window.location.href = 'admin-login.html';
        }
    }
});