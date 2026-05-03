/**
 * API Client Module
 * Handles all HTTP requests to the backend API
 */

// API Configuration
const API_CONFIG = {
    // Base URL - change this to your server URL
    baseURL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api' 
        : '/api',
    timeout: 10000, // 10 seconds
};

// Create Axios instance with default configuration
const apiClient = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: API_CONFIG.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add JWT token to requests
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle common errors
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            // Handle 401 Unauthorized - Token expired
            if (error.response.status === 401) {
                console.error('Authentication failed - redirecting to login');
                Auth.logout();
                return Promise.reject(error);
            }
            
            // Handle 429 Too Many Requests
            if (error.response.status === 429) {
                showToast('请求过于频繁，请稍后再试', 'warning');
            }
            
            // Handle 500 Internal Server Error
            if (error.response.status === 500) {
                showToast('服务器错误，请稍后再试', 'danger');
            }
        } else if (error.request) {
            // Network error
            showToast('网络连接失败，请检查网络', 'danger');
        }
        
        return Promise.reject(error);
    }
);

/**
 * API Methods
 */
const API = {
    // ==================== Authentication ====================
    
    /**
     * Login
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise} Response with JWT token
     */
    login: async (username, password) => {
        const response = await apiClient.post('/auth/login', {
            username,
            password,
        });
        return response.data;
    },

    // ==================== Cards Management ====================
    
    /**
     * Get cards list
     * @param {Object} params - Query parameters (page, limit, enabled, search)
     * @returns {Promise} Cards list with pagination
     */
    getCards: async (params = {}) => {
        const response = await apiClient.get('/cards', { params });
        return response.data;
    },

    /**
     * Add new card
     * @param {Object} cardData - Card information
     * @returns {Promise} Created card data
     */
    addCard: async (cardData) => {
        const response = await apiClient.post('/cards', cardData);
        return response.data;
    },

    /**
     * Update card
     * @param {string} uid - Card UID
     * @param {Object} cardData - Updated card information
     * @returns {Promise} Update result
     */
    updateCard: async (uid, cardData) => {
        const response = await apiClient.put(`/cards/${uid}`, cardData);
        return response.data;
    },

    /**
     * Delete card
     * @param {string} uid - Card UID
     * @returns {Promise} Delete result
     */
    deleteCard: async (uid) => {
        const response = await apiClient.delete(`/cards/${uid}`);
        return response.data;
    },

    // ==================== Devices Management ====================
    
    /**
     * Get devices list
     * @returns {Promise} Devices list
     */
    getDevices: async () => {
        const response = await apiClient.get('/devices');
        return response.data;
    },

    /**
     * Register new device
     * @param {Object} deviceData - Device information
     * @returns {Promise} Created device data with API key
     */
    addDevice: async (deviceData) => {
        const response = await apiClient.post('/devices', deviceData);
        return response.data;
    },

    /**
     * Update device
     * @param {string} deviceId - Device ID
     * @param {Object} deviceData - Updated device information
     * @returns {Promise} Update result
     */
    updateDevice: async (deviceId, deviceData) => {
        const response = await apiClient.put(`/devices/${deviceId}`, deviceData);
        return response.data;
    },

    // ==================== Access Logs ====================
    
    /**
     * Get access logs
     * @param {Object} params - Query parameters (page, limit, device_id, uid, allowed, start_time, end_time)
     * @returns {Promise} Logs list with pagination
     */
    getLogs: async (params = {}) => {
        const response = await apiClient.get('/logs', { params });
        return response.data;
    },

    // ==================== Real-time Status ====================
    
    /**
     * Get real-time system status
     * @returns {Promise} System status and statistics
     */
    getStatus: async () => {
        const response = await apiClient.get('/status');
        return response.data;
    },
};

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, danger, warning, info)
 */
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('toastNotification');
    const toastBody = toastEl.querySelector('.toast-body');
    const toastHeader = toastEl.querySelector('.toast-header');
    
    // Set message
    toastBody.textContent = message;
    
    // Set icon based on type
    const iconMap = {
        success: 'bi-check-circle-fill text-success',
        danger: 'bi-exclamation-circle-fill text-danger',
        warning: 'bi-exclamation-triangle-fill text-warning',
        info: 'bi-info-circle-fill text-info',
    };
    
    const icon = toastHeader.querySelector('i');
    icon.className = `${iconMap[type] || iconMap.info} me-2`;
    
    // Show toast
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

/**
 * Show loading spinner
 */
function showLoading() {
    document.getElementById('loadingSpinner').classList.remove('d-none');
}

/**
 * Hide loading spinner
 */
function hideLoading() {
    document.getElementById('loadingSpinner').classList.add('d-none');
}

/**
 * Format date to local string
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

/**
 * Format time to HH:MM:SS
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted time string
 */
function formatTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

/**
 * Calculate time ago
 * @param {string} dateString - ISO date string
 * @returns {string} Time ago string
 */
function timeAgo(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds}秒前`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}天前`;
    return formatDate(dateString);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
