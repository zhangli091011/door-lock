/**
 * API Client Module
 * Handles all HTTP requests to the backend API
 */

// API Configuration
const API_CONFIG = {
    // Base URL - 使用相对路径，通过nginx代理
    // 访问 door.sparkmaker.club 时，API会自动指向 door.sparkmaker.club/api
    baseURL: (() => {
        const hostname = window.location.hostname;
        
        // 本地开发环境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        
        // 自定义API地址（可在index.html中设置）
        if (window.API_BASE_URL) {
            return window.API_BASE_URL;
        }
        
        // 生产环境：使用相对路径，通过nginx代理
        // 例如：door.sparkmaker.club/api
        return '/api';
    })(),
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
 * Format date to local string (强制显示UTC+8时间)
 * @param {string} dateString - ISO date string or timestamp
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    
    // 解析时间
    let date = new Date(dateString);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) return '-';
    
    // 强制加8小时转换为UTC+8
    const utc8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    
    // 使用UTC方法获取时间（此时已经是UTC+8）
    const year = utc8Date.getUTCFullYear();
    const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Date.getUTCDate()).padStart(2, '0');
    const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
    const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format time to HH:MM:SS (强制显示UTC+8时间)
 * @param {string} dateString - ISO date string or timestamp
 * @returns {string} Formatted time string
 */
function formatTime(dateString) {
    if (!dateString) return '-';
    
    // 解析时间
    let date = new Date(dateString);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) return '-';
    
    // 强制加8小时转换为UTC+8
    const utc8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    
    // 使用UTC方法获取时间（此时已经是UTC+8）
    const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
    const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate time ago (强制使用UTC+8时间计算)
 * @param {string} dateString - ISO date string
 * @returns {string} Time ago string
 */
function timeAgo(dateString) {
    if (!dateString) return '-';
    
    // 解析时间并加8小时
    const date = new Date(dateString);
    const utc8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    
    // 当前时间也加8小时
    const now = new Date();
    const utc8Now = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    const seconds = Math.floor((utc8Now - utc8Date) / 1000);
    
    if (seconds < 0) return '刚刚';
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
