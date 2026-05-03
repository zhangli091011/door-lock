/**
 * Main Application Module
 * Handles page routing, navigation, and UI interactions
 */

const App = {
    currentPage: 'status',
    refreshInterval: null,

    /**
     * Initialize application
     */
    init: () => {
        console.log('Initializing NFC Access Control Admin Panel...');
        
        // Initialize authentication
        const isAuthenticated = Auth.init();
        
        if (isAuthenticated) {
            // Setup navigation
            App.setupNavigation();
            
            // Load default page
            App.loadPage('status');
        }
    },

    /**
     * Setup navigation handlers
     */
    setupNavigation: () => {
        const navLinks = document.querySelectorAll('.sidebar .nav-link');
        
        navLinks.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const page = link.getAttribute('data-page');
                
                // Update active state
                navLinks.forEach((l) => l.classList.remove('active'));
                link.classList.add('active');
                
                // Load page
                App.loadPage(page);
            });
        });
    },

    /**
     * Load page content
     * @param {string} pageName - Page name (status, cards, devices, logs)
     */
    loadPage: (pageName) => {
        console.log(`Loading page: ${pageName}`);
        
        App.currentPage = pageName;
        
        // Clear refresh interval
        if (App.refreshInterval) {
            clearInterval(App.refreshInterval);
            App.refreshInterval = null;
        }
        
        // Load page content
        switch (pageName) {
            case 'status':
                App.loadStatusPage();
                break;
            case 'cards':
                App.loadCardsPage();
                break;
            case 'devices':
                App.loadDevicesPage();
                break;
            case 'logs':
                App.loadLogsPage();
                break;
            default:
                App.loadStatusPage();
        }
    },

    /**
     * Load Status Page (Real-time system status)
     */
    loadStatusPage: async () => {
        const content = document.getElementById('pageContent');
        
        content.innerHTML = `
            <div class="page-header">
                <h1><i class="bi bi-speedometer2"></i> 实时状态</h1>
                <button class="btn btn-primary btn-sm" onclick="App.loadStatusPage()">
                    <i class="bi bi-arrow-clockwise"></i> 刷新
                </button>
            </div>
            
            <!-- Statistics Cards -->
            <div class="row" id="statsCards">
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-hdd-network stat-icon text-primary"></i>
                        <div class="stat-value" id="onlineDevices">-</div>
                        <div class="stat-label">在线设备</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-credit-card stat-icon text-success"></i>
                        <div class="stat-value" id="activeCards">-</div>
                        <div class="stat-label">启用卡片</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-check-circle stat-icon text-info"></i>
                        <div class="stat-value" id="todayAccess">-</div>
                        <div class="stat-label">今日访问</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-x-circle stat-icon text-danger"></i>
                        <div class="stat-value" id="todayDenied">-</div>
                        <div class="stat-label">今日拒绝</div>
                    </div>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="row mt-4">
                <div class="col-md-12">
                    <div class="table-container">
                        <h5 class="mb-3"><i class="bi bi-clock-history"></i> 最近访问记录</h5>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>时间</th>
                                        <th>卡片</th>
                                        <th>设备</th>
                                        <th>结果</th>
                                    </tr>
                                </thead>
                                <tbody id="recentActivityTable">
                                    <tr>
                                        <td colspan="4" class="text-center">加载中...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Load status data
        await App.refreshStatusData();
        
        // Auto refresh every 5 seconds
        App.refreshInterval = setInterval(App.refreshStatusData, 5000);
    },

    /**
     * Refresh status data
     */
    refreshStatusData: async () => {
        try {
            const response = await API.getStatus();
            
            if (response.success && response.data) {
                const { statistics, recent_access } = response.data;
                
                // Update statistics
                if (statistics) {
                    document.getElementById('onlineDevices').textContent = 
                        `${statistics.online_devices || 0} / ${statistics.total_devices || 0}`;
                    document.getElementById('activeCards').textContent = 
                        `${statistics.active_cards || 0} / ${statistics.total_cards || 0}`;
                    document.getElementById('todayAccess').textContent = 
                        statistics.today_access || 0;
                    document.getElementById('todayDenied').textContent = 
                        statistics.today_denied || 0;
                }
                
                // Update recent activity
                if (recent_access && recent_access.length > 0) {
                    const tbody = document.getElementById('recentActivityTable');
                    tbody.innerHTML = recent_access.map((log) => `
                        <tr>
                            <td>${formatTime(log.timestamp)}</td>
                            <td>${escapeHtml(log.card_name || log.uid)}</td>
                            <td>${escapeHtml(log.device_name || log.device_id)}</td>
                            <td>
                                <span class="badge ${log.allowed ? 'status-allowed' : 'status-denied'}">
                                    ${log.allowed ? '允许' : '拒绝'}
                                </span>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    document.getElementById('recentActivityTable').innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center text-muted">暂无访问记录</td>
                        </tr>
                    `;
                }
            }
        } catch (error) {
            console.error('Failed to load status:', error);
        }
    },

    /**
     * Load Cards Page (Card management)
     */
    loadCardsPage: () => {
        const content = document.getElementById('pageContent');
        
        content.innerHTML = `
            <div class="page-header">
                <h1><i class="bi bi-credit-card"></i> 卡片管理</h1>
                <button class="btn btn-primary" onclick="App.showAddCardModal()">
                    <i class="bi bi-plus-circle"></i> 添加卡片
                </button>
            </div>
            
            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="row">
                    <div class="col-md-4">
                        <input type="text" class="form-control" id="cardSearch" placeholder="搜索UID或姓名...">
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="cardStatusFilter">
                            <option value="">全部状态</option>
                            <option value="true">已启用</option>
                            <option value="false">已禁用</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-primary w-100" onclick="App.loadCardsData()">
                            <i class="bi bi-search"></i> 搜索
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Cards Table -->
            <div class="table-container">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>UID</th>
                                <th>姓名</th>
                                <th>状态</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="cardsTableBody">
                            <tr>
                                <td colspan="5" class="text-center">加载中...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="cardsPagination"></div>
            </div>
        `;
        
        // Load cards data
        App.loadCardsData();
    },

    /**
     * Load cards data
     */
    loadCardsData: async (page = 1) => {
        try {
            showLoading();
            
            const search = document.getElementById('cardSearch')?.value || '';
            const enabled = document.getElementById('cardStatusFilter')?.value || '';
            
            const params = {
                page,
                limit: 20,
            };
            
            if (search) params.search = search;
            if (enabled) params.enabled = enabled;
            
            const response = await API.getCards(params);
            
            if (response.success && response.data) {
                const { cards, pagination } = response.data;
                
                const tbody = document.getElementById('cardsTableBody');
                
                if (cards && cards.length > 0) {
                    tbody.innerHTML = cards.map((card) => `
                        <tr>
                            <td><code>${escapeHtml(card.uid)}</code></td>
                            <td>${escapeHtml(card.name)}</td>
                            <td>
                                <span class="badge ${card.enabled ? 'status-enabled' : 'status-disabled'}">
                                    ${card.enabled ? '已启用' : '已禁用'}
                                </span>
                            </td>
                            <td>${formatDate(card.created_at)}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="App.showEditCardModal('${card.uid}')">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="App.deleteCard('${card.uid}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                    
                    // Render pagination
                    App.renderPagination('cardsPagination', pagination, App.loadCardsData);
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center text-muted">暂无卡片数据</td>
                        </tr>
                    `;
                }
            }
        } catch (error) {
            console.error('Failed to load cards:', error);
            showToast('加载卡片数据失败', 'danger');
        } finally {
            hideLoading();
        }
    },

    /**
     * Load Devices Page (Device management)
     */
    loadDevicesPage: () => {
        const content = document.getElementById('pageContent');
        
        content.innerHTML = `
            <div class="page-header">
                <h1><i class="bi bi-hdd-network"></i> 设备管理</h1>
                <button class="btn btn-primary" onclick="App.showAddDeviceModal()">
                    <i class="bi bi-plus-circle"></i> 注册设备
                </button>
            </div>
            
            <!-- Devices Table -->
            <div class="table-container">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>设备ID</th>
                                <th>名称</th>
                                <th>位置</th>
                                <th>状态</th>
                                <th>最后在线</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="devicesTableBody">
                            <tr>
                                <td colspan="6" class="text-center">加载中...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Load devices data
        App.loadDevicesData();
    },

    /**
     * Load devices data
     */
    loadDevicesData: async () => {
        try {
            showLoading();
            
            const response = await API.getDevices();
            
            if (response.success && response.data) {
                const devices = response.data.devices || response.data;
                
                const tbody = document.getElementById('devicesTableBody');
                
                if (devices && devices.length > 0) {
                    tbody.innerHTML = devices.map((device) => {
                        const isOnline = device.online || App.isDeviceOnline(device.last_seen);
                        
                        return `
                            <tr>
                                <td><code>${escapeHtml(device.device_id)}</code></td>
                                <td>${escapeHtml(device.name)}</td>
                                <td>${escapeHtml(device.location || '-')}</td>
                                <td>
                                    <span class="badge ${isOnline ? 'status-online' : 'status-offline'}">
                                        ${isOnline ? '在线' : '离线'}
                                    </span>
                                </td>
                                <td>${timeAgo(device.last_seen)}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="App.showEditDeviceModal('${device.device_id}')">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center text-muted">暂无设备数据</td>
                        </tr>
                    `;
                }
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
            showToast('加载设备数据失败', 'danger');
        } finally {
            hideLoading();
        }
    },

    /**
     * Check if device is online (last seen < 5 minutes)
     */
    isDeviceOnline: (lastSeen) => {
        if (!lastSeen) return false;
        const lastSeenTime = new Date(lastSeen).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        return (now - lastSeenTime) < fiveMinutes;
    },

    /**
     * Load Logs Page (Access logs)
     */
    loadLogsPage: () => {
        const content = document.getElementById('pageContent');
        
        content.innerHTML = `
            <div class="page-header">
                <h1><i class="bi bi-journal-text"></i> 访问日志</h1>
                <button class="btn btn-primary btn-sm" onclick="App.loadLogsData()">
                    <i class="bi bi-arrow-clockwise"></i> 刷新
                </button>
            </div>
            
            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="row">
                    <div class="col-md-3">
                        <input type="text" class="form-control" id="logUidFilter" placeholder="卡片UID">
                    </div>
                    <div class="col-md-3">
                        <input type="text" class="form-control" id="logDeviceFilter" placeholder="设备ID">
                    </div>
                    <div class="col-md-2">
                        <select class="form-select" id="logStatusFilter">
                            <option value="">全部结果</option>
                            <option value="true">允许</option>
                            <option value="false">拒绝</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-primary w-100" onclick="App.loadLogsData()">
                            <i class="bi bi-search"></i> 搜索
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Logs Table -->
            <div class="table-container">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>卡片</th>
                                <th>设备</th>
                                <th>结果</th>
                                <th>来源</th>
                                <th>原因</th>
                            </tr>
                        </thead>
                        <tbody id="logsTableBody">
                            <tr>
                                <td colspan="6" class="text-center">加载中...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="logsPagination"></div>
            </div>
        `;
        
        // Load logs data
        App.loadLogsData();
    },

    /**
     * Load logs data
     */
    loadLogsData: async (page = 1) => {
        try {
            showLoading();
            
            const uid = document.getElementById('logUidFilter')?.value || '';
            const deviceId = document.getElementById('logDeviceFilter')?.value || '';
            const allowed = document.getElementById('logStatusFilter')?.value || '';
            
            const params = {
                page,
                limit: 50,
            };
            
            if (uid) params.uid = uid;
            if (deviceId) params.device_id = deviceId;
            if (allowed) params.allowed = allowed;
            
            const response = await API.getLogs(params);
            
            if (response.success && response.data) {
                const { logs, pagination } = response.data;
                
                const tbody = document.getElementById('logsTableBody');
                
                if (logs && logs.length > 0) {
                    tbody.innerHTML = logs.map((log) => `
                        <tr>
                            <td>${formatDate(log.timestamp)}</td>
                            <td>
                                <div>${escapeHtml(log.card_name || '-')}</div>
                                <small class="text-muted"><code>${escapeHtml(log.uid)}</code></small>
                            </td>
                            <td>
                                <div>${escapeHtml(log.device_name || '-')}</div>
                                <small class="text-muted"><code>${escapeHtml(log.device_id)}</code></small>
                            </td>
                            <td>
                                <span class="badge ${log.allowed ? 'status-allowed' : 'status-denied'}">
                                    ${log.allowed ? '允许' : '拒绝'}
                                </span>
                            </td>
                            <td>
                                <span class="badge bg-secondary">
                                    ${log.source === 'cloud' ? '云端' : '缓存'}
                                </span>
                            </td>
                            <td>${escapeHtml(log.reason || '-')}</td>
                        </tr>
                    `).join('');
                    
                    // Render pagination
                    App.renderPagination('logsPagination', pagination, App.loadLogsData);
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center text-muted">暂无日志数据</td>
                        </tr>
                    `;
                }
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
            showToast('加载日志数据失败', 'danger');
        } finally {
            hideLoading();
        }
    },

    /**
     * Render pagination
     */
    renderPagination: (containerId, pagination, loadFunction) => {
        const container = document.getElementById(containerId);
        if (!container || !pagination) return;
        
        const { page, pages, total } = pagination;
        
        if (pages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<nav><ul class="pagination">';
        
        // Previous button
        html += `
            <li class="page-item ${page === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="App.${loadFunction.name}(${page - 1}); return false;">上一页</a>
            </li>
        `;
        
        // Page numbers
        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
                html += `
                    <li class="page-item ${i === page ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="App.${loadFunction.name}(${i}); return false;">${i}</a>
                    </li>
                `;
            } else if (i === page - 3 || i === page + 3) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }
        
        // Next button
        html += `
            <li class="page-item ${page === pages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="App.${loadFunction.name}(${page + 1}); return false;">下一页</a>
            </li>
        `;
        
        html += '</ul></nav>';
        html += `<div class="text-center text-muted mt-2">共 ${total} 条记录</div>`;
        
        container.innerHTML = html;
    },

    /**
     * Placeholder methods for modal operations
     * These will be implemented in subsequent tasks (13.3, 13.4)
     */
    showAddCardModal: () => {
        showToast('添加卡片功能将在后续任务中实现', 'info');
    },

    showEditCardModal: (uid) => {
        showToast('编辑卡片功能将在后续任务中实现', 'info');
    },

    deleteCard: (uid) => {
        showToast('删除卡片功能将在后续任务中实现', 'info');
    },

    showAddDeviceModal: () => {
        showToast('添加设备功能将在后续任务中实现', 'info');
    },

    showEditDeviceModal: (deviceId) => {
        showToast('编辑设备功能将在后续任务中实现', 'info');
    },
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
