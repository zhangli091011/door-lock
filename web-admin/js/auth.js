/**
 * Authentication Module
 * Handles user authentication and JWT token management
 */

const Auth = {
    /**
     * Check if user is authenticated
     * @returns {boolean} True if authenticated
     */
    isAuthenticated: () => {
        const token = localStorage.getItem('jwt_token');
        if (!token) return false;
        
        // Check if token is expired
        try {
            const payload = Auth.parseJWT(token);
            const now = Math.floor(Date.now() / 1000);
            
            if (payload.exp && payload.exp < now) {
                // Token expired
                Auth.logout();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Invalid token:', error);
            Auth.logout();
            return false;
        }
    },

    /**
     * Parse JWT token
     * @param {string} token - JWT token
     * @returns {Object} Decoded payload
     */
    parseJWT: (token) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (error) {
            throw new Error('Invalid JWT token');
        }
    },

    /**
     * Login user
     * @param {string} username - Username
     * @param {string} password - Password
     * @param {boolean} rememberMe - Remember me option
     * @returns {Promise} Login result
     */
    login: async (username, password, rememberMe = false) => {
        try {
            showLoading();
            
            const response = await API.login(username, password);
            
            if (response.success && response.token) {
                // Store JWT token
                localStorage.setItem('jwt_token', response.token);
                
                // Store username
                localStorage.setItem('username', username);
                
                // Store remember me preference
                if (rememberMe) {
                    localStorage.setItem('remember_me', 'true');
                } else {
                    localStorage.removeItem('remember_me');
                }
                
                return { success: true };
            } else {
                return { 
                    success: false, 
                    message: response.message || '登录失败' 
                };
            }
        } catch (error) {
            console.error('Login error:', error);
            
            let message = '登录失败，请稍后再试';
            
            if (error.response) {
                if (error.response.status === 401) {
                    message = '用户名或密码错误';
                } else if (error.response.data && error.response.data.message) {
                    message = error.response.data.message;
                }
            }
            
            return { success: false, message };
        } finally {
            hideLoading();
        }
    },

    /**
     * Logout user
     */
    logout: () => {
        // Clear stored data
        localStorage.removeItem('jwt_token');
        
        // Keep username if remember me is enabled
        const rememberMe = localStorage.getItem('remember_me');
        if (!rememberMe) {
            localStorage.removeItem('username');
        }
        
        // Redirect to login page
        Auth.showLoginPage();
    },

    /**
     * Show login page
     */
    showLoginPage: () => {
        document.getElementById('loginPage').classList.remove('d-none');
        document.getElementById('mainApp').classList.add('d-none');
        
        // Pre-fill username if remember me is enabled
        const rememberMe = localStorage.getItem('remember_me');
        const username = localStorage.getItem('username');
        
        if (rememberMe && username) {
            document.getElementById('username').value = username;
            document.getElementById('rememberMe').checked = true;
        }
    },

    /**
     * Show main application
     */
    showMainApp: () => {
        document.getElementById('loginPage').classList.add('d-none');
        document.getElementById('mainApp').classList.remove('d-none');
        
        // Set current user display
        const username = localStorage.getItem('username') || '管理员';
        document.getElementById('currentUser').textContent = username;
    },

    /**
     * Initialize authentication
     */
    init: () => {
        // Check if user is already authenticated
        if (Auth.isAuthenticated()) {
            Auth.showMainApp();
            return true;
        } else {
            Auth.showLoginPage();
            return false;
        }
    },

    /**
     * Get current user info from token
     * @returns {Object|null} User info or null
     */
    getCurrentUser: () => {
        const token = localStorage.getItem('jwt_token');
        if (!token) return null;
        
        try {
            const payload = Auth.parseJWT(token);
            return {
                id: payload.id || payload.userId,
                username: payload.username || localStorage.getItem('username'),
                role: payload.role || 'admin',
            };
        } catch (error) {
            console.error('Failed to get current user:', error);
            return null;
        }
    },

    /**
     * Get JWT token
     * @returns {string|null} JWT token or null
     */
    getToken: () => {
        return localStorage.getItem('jwt_token');
    },
};

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    // Setup login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            // Validate input
            if (!username || !password) {
                showLoginError('请输入用户名和密码');
                return;
            }
            
            // Clear previous error
            hideLoginError();
            
            // Attempt login
            const result = await Auth.login(username, password, rememberMe);
            
            if (result.success) {
                // Login successful
                showToast('登录成功', 'success');
                Auth.showMainApp();
                
                // Load default page (status)
                if (typeof App !== 'undefined' && App.loadPage) {
                    App.loadPage('status');
                }
            } else {
                // Login failed
                showLoginError(result.message);
            }
        });
    }
    
    // Setup logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (confirm('确定要退出登录吗？')) {
                showToast('已退出登录', 'info');
                Auth.logout();
            }
        });
    }
});

/**
 * Show login error message
 * @param {string} message - Error message
 */
function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
}

/**
 * Hide login error message
 */
function hideLoginError() {
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.add('d-none');
}
