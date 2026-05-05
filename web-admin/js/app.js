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
                        const isOnline = device.is_online || App.isDeviceOnline(device.last_seen);
                        
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
        
        // Get today's date range
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        
        content.innerHTML = `
            <div class="page-header">
                <h1><i class="bi bi-journal-text"></i> 访问日志</h1>
                <div>
                    <button class="btn btn-success btn-sm me-2" onclick="App.exportLogs()">
                        <i class="bi bi-download"></i> 导出日志
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="App.loadLogsData()">
                        <i class="bi bi-arrow-clockwise"></i> 刷新
                    </button>
                </div>
            </div>
            
            <!-- Statistics Cards -->
            <div class="row mb-4" id="logStats">
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-calendar-check stat-icon text-primary"></i>
                        <div class="stat-value" id="todayTotal">-</div>
                        <div class="stat-label">今日总访问</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-check-circle stat-icon text-success"></i>
                        <div class="stat-value" id="todayAllowed">-</div>
                        <div class="stat-label">今日允许</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-x-circle stat-icon text-danger"></i>
                        <div class="stat-value" id="todayDenied">-</div>
                        <div class="stat-label">今日拒绝</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card text-center">
                        <i class="bi bi-percent stat-icon text-info"></i>
                        <div class="stat-value" id="todaySuccessRate">-</div>
                        <div class="stat-label">今日成功率</div>
                    </div>
                </div>
            </div>
            
            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="row">
                    <div class="col-md-2">
                        <label class="form-label">卡片UID</label>
                        <input type="text" class="form-control" id="logUidFilter" placeholder="输入UID">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">设备ID</label>
                        <input type="text" class="form-control" id="logDeviceFilter" placeholder="输入设备ID">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">访问结果</label>
                        <select class="form-select" id="logStatusFilter">
                            <option value="">全部结果</option>
                            <option value="true">允许</option>
                            <option value="false">拒绝</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">开始时间</label>
                        <input type="datetime-local" class="form-control" id="logStartTime">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">结束时间</label>
                        <input type="datetime-local" class="form-control" id="logEndTime">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">&nbsp;</label>
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" onclick="App.loadLogsData()">
                                <i class="bi bi-search"></i> 搜索
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="App.resetLogFilters()">
                                <i class="bi bi-x-circle"></i> 重置
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Filter Buttons -->
                <div class="row mt-3">
                    <div class="col-md-12">
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-primary" onclick="App.setLogTimeRange('today')">
                                今天
                            </button>
                            <button type="button" class="btn btn-outline-primary" onclick="App.setLogTimeRange('yesterday')">
                                昨天
                            </button>
                            <button type="button" class="btn btn-outline-primary" onclick="App.setLogTimeRange('week')">
                                本周
                            </button>
                            <button type="button" class="btn btn-outline-primary" onclick="App.setLogTimeRange('month')">
                                本月
                            </button>
                            <button type="button" class="btn btn-outline-primary" onclick="App.setLogTimeRange('all')">
                                全部
                            </button>
                        </div>
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
                                <th>卡片信息</th>
                                <th>设备信息</th>
                                <th>访问结果</th>
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
        
        // Set default time range to today
        App.setLogTimeRange('today');
        
        // Load logs data
        App.loadLogsData();
        
        // Load statistics
        App.loadLogStatistics();
    },

    /**
     * Load log statistics
     */
    loadLogStatistics: async () => {
        try {
            const response = await API.getStatus();
            
            if (response.success && response.data && response.data.statistics) {
                const stats = response.data.statistics;
                
                const todayTotal = stats.today_access + stats.today_denied;
                const successRate = todayTotal > 0 
                    ? ((stats.today_access / todayTotal) * 100).toFixed(1) 
                    : '0.0';
                
                document.getElementById('todayTotal').textContent = todayTotal;
                document.getElementById('todayAllowed').textContent = stats.today_access;
                document.getElementById('todayDenied').textContent = stats.today_denied;
                document.getElementById('todaySuccessRate').textContent = successRate + '%';
            }
        } catch (error) {
            console.error('Failed to load log statistics:', error);
        }
    },

    /**
     * Set log time range
     */
    setLogTimeRange: (range) => {
        const now = new Date();
        let startTime, endTime;
        
        switch (range) {
            case 'today':
                startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'yesterday':
                startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
                break;
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                startTime = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
                endTime = now;
                break;
            case 'month':
                startTime = new Date(now.getFullYear(), now.getMonth(), 1);
                endTime = now;
                break;
            case 'all':
                document.getElementById('logStartTime').value = '';
                document.getElementById('logEndTime').value = '';
                return;
        }
        
        // Format to datetime-local input format
        const formatDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        document.getElementById('logStartTime').value = formatDateTime(startTime);
        document.getElementById('logEndTime').value = formatDateTime(endTime);
    },

    /**
     * Reset log filters
     */
    resetLogFilters: () => {
        document.getElementById('logUidFilter').value = '';
        document.getElementById('logDeviceFilter').value = '';
        document.getElementById('logStatusFilter').value = '';
        document.getElementById('logStartTime').value = '';
        document.getElementById('logEndTime').value = '';
        App.loadLogsData();
    },

    /**
     * Export logs to CSV
     */
    exportLogs: async () => {
        try {
            showLoading();
            
            const uid = document.getElementById('logUidFilter')?.value || '';
            const deviceId = document.getElementById('logDeviceFilter')?.value || '';
            const allowed = document.getElementById('logStatusFilter')?.value || '';
            const startTime = document.getElementById('logStartTime')?.value || '';
            const endTime = document.getElementById('logEndTime')?.value || '';
            
            const params = {
                page: 1,
                limit: 10000, // Export all matching records
            };
            
            if (uid) params.uid = uid;
            if (deviceId) params.device_id = deviceId;
            if (allowed) params.allowed = allowed;
            if (startTime) params.start_time = new Date(startTime).toISOString();
            if (endTime) params.end_time = new Date(endTime).toISOString();
            
            const response = await API.getLogs(params);
            
            if (response.success && response.data) {
                const logs = response.data.logs;
                
                if (logs.length === 0) {
                    showToast('没有符合条件的日志记录', 'warning');
                    return;
                }
                
                // Generate CSV content
                let csv = '\uFEFF'; // UTF-8 BOM for Excel
                csv += '时间,卡片UID,持卡人,设备ID,设备名称,访问结果,来源,原因\n';
                
                logs.forEach(log => {
                    const timestamp = formatDate(log.timestamp);
                    const uid = log.uid || '';
                    const cardName = log.card_name || '未知';
                    const deviceId = log.device_id || '';
                    const deviceName = log.device_name || '未知';
                    const allowed = log.allowed ? '允许' : '拒绝';
                    const source = log.source === 'cloud' ? '云端' : '缓存';
                    const reason = log.reason || '';
                    
                    csv += `"${timestamp}","${uid}","${cardName}","${deviceId}","${deviceName}","${allowed}","${source}","${reason}"\n`;
                });
                
                // Create download link
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                
                const filename = `access_logs_${new Date().toISOString().slice(0, 10)}.csv`;
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showToast(`已导出 ${logs.length} 条日志记录`, 'success');
            }
        } catch (error) {
            console.error('Failed to export logs:', error);
            showToast('导出日志失败', 'danger');
        } finally {
            hideLoading();
        }
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
            const startTime = document.getElementById('logStartTime')?.value || '';
            const endTime = document.getElementById('logEndTime')?.value || '';
            
            const params = {
                page,
                limit: 50,
            };
            
            if (uid) params.uid = uid;
            if (deviceId) params.device_id = deviceId;
            if (allowed) params.allowed = allowed;
            if (startTime) params.start_time = new Date(startTime).toISOString();
            if (endTime) params.end_time = new Date(endTime).toISOString();
            
            const response = await API.getLogs(params);
            
            if (response.success && response.data) {
                const { logs, pagination } = response.data;
                
                const tbody = document.getElementById('logsTableBody');
                
                if (logs && logs.length > 0) {
                    tbody.innerHTML = logs.map((log) => `
                        <tr>
                            <td>
                                <div>${formatDate(log.timestamp)}</div>
                                <small class="text-muted">${timeAgo(log.timestamp)}</small>
                            </td>
                            <td>
                                <div><strong>${escapeHtml(log.card_name || '未知')}</strong></div>
                                <small class="text-muted"><code>${escapeHtml(log.uid)}</code></small>
                            </td>
                            <td>
                                <div>${escapeHtml(log.device_name || '未知')}</div>
                                <small class="text-muted"><code>${escapeHtml(log.device_id)}</code></small>
                            </td>
                            <td>
                                <span class="badge ${log.allowed ? 'status-allowed' : 'status-denied'}">
                                    <i class="bi ${log.allowed ? 'bi-check-circle' : 'bi-x-circle'}"></i>
                                    ${log.allowed ? '允许' : '拒绝'}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${log.source === 'cloud' ? 'bg-primary' : 'bg-secondary'}">
                                    <i class="bi ${log.source === 'cloud' ? 'bi-cloud' : 'bi-hdd'}"></i>
                                    ${log.source === 'cloud' ? '云端' : '缓存'}
                                </span>
                            </td>
                            <td>
                                <small>${escapeHtml(log.reason || '-')}</small>
                            </td>
                        </tr>
                    `).join('');
                    
                    // Render pagination
                    App.renderPagination('logsPagination', pagination, App.loadLogsData);
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center text-muted">
                                <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                                <p class="mt-2">暂无日志数据</p>
                                <small>尝试调整筛选条件或时间范围</small>
                            </td>
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
     * Show Add Card Modal
     */
    showAddCardModal: () => {
        // Reset form
        document.getElementById('addCardForm').reset();
        document.getElementById('cardTimeSlots').value = '';
        document.getElementById('cardAllowedDevices').value = '';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addCardModal'));
        modal.show();
    },

    /**
     * Submit Add Card Form
     */
    submitAddCard: async () => {
        try {
            const form = document.getElementById('addCardForm');
            
            // Validate form
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const uid = document.getElementById('cardUid').value.trim().toUpperCase();
            const name = document.getElementById('cardName').value.trim();
            const enabled = document.getElementById('cardEnabled').checked;
            const cacheable = document.getElementById('cardCacheable').checked;
            const accessStart = document.getElementById('cardAccessStart').value || null;
            const accessEnd = document.getElementById('cardAccessEnd').value || null;
            const timeSlotsStr = document.getElementById('cardTimeSlots').value.trim();
            const allowedDevicesStr = document.getElementById('cardAllowedDevices').value.trim();
            
            // Validate UID format
            if (!/^[0-9A-F]{8,14}$/.test(uid)) {
                showToast('UID格式不正确，必须是8-14位十六进制字符', 'danger');
                return;
            }
            
            // Parse time slots
            let timeSlots = null;
            if (timeSlotsStr) {
                try {
                    timeSlots = timeSlotsStr.split(',').map(s => s.trim()).filter(s => s);
                    // Validate format
                    const timeSlotRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])-([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
                    for (const slot of timeSlots) {
                        if (!timeSlotRegex.test(slot)) {
                            showToast(`时间段格式错误: ${slot}，应为 HH:MM-HH:MM`, 'danger');
                            return;
                        }
                    }
                } catch (e) {
                    showToast('时间段格式错误', 'danger');
                    return;
                }
            }
            
            // Parse allowed devices
            let allowedDevices = null;
            if (allowedDevicesStr) {
                allowedDevices = allowedDevicesStr.split(',').map(s => s.trim()).filter(s => s);
            }
            
            showLoading();
            
            const cardData = {
                uid,
                name,
                enabled,
                cacheable,
                access_start: accessStart,
                access_end: accessEnd,
                time_slots: timeSlots,
                allowed_devices: allowedDevices,
            };
            
            const response = await API.addCard(cardData);
            
            if (response.success) {
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addCardModal'));
                modal.hide();
                
                // Reload cards list
                App.loadCardsData();
                
                showToast('卡片添加成功', 'success');
            } else {
                showToast(response.message || '卡片添加失败', 'danger');
            }
        } catch (error) {
            console.error('Failed to add card:', error);
            
            if (error.response && error.response.data) {
                showToast(error.response.data.message || '卡片添加失败', 'danger');
            } else {
                showToast('卡片添加失败，请稍后重试', 'danger');
            }
        } finally {
            hideLoading();
        }
    },

    /**
     * Show Edit Card Modal
     */
    showEditCardModal: async (uid) => {
        try {
            showLoading();
            
            // Fetch card details
            const response = await API.getCards({ search: uid });
            
            if (response.success && response.data) {
                const cards = response.data.cards;
                const card = cards.find(c => c.uid === uid);
                
                if (!card) {
                    showToast('卡片不存在', 'danger');
                    return;
                }
                
                // Populate form
                document.getElementById('editCardUid').value = card.uid;
                document.getElementById('editCardUidDisplay').value = card.uid;
                document.getElementById('editCardName').value = card.name;
                document.getElementById('editCardEnabled').checked = card.enabled;
                document.getElementById('editCardCacheable').checked = card.cacheable;
                document.getElementById('editCardAccessStart').value = card.access_start ? card.access_start.substring(0, 16) : '';
                document.getElementById('editCardAccessEnd').value = card.access_end ? card.access_end.substring(0, 16) : '';
                document.getElementById('editCardTimeSlots').value = card.time_slots ? card.time_slots.join(', ') : '';
                document.getElementById('editCardAllowedDevices').value = card.allowed_devices ? card.allowed_devices.join(', ') : '';
                
                // Show modal
                const modal = new bootstrap.Modal(document.getElementById('editCardModal'));
                modal.show();
            }
        } catch (error) {
            console.error('Failed to load card details:', error);
            showToast('加载卡片信息失败', 'danger');
        } finally {
            hideLoading();
        }
    },

    /**
     * Submit Edit Card Form
     */
    submitEditCard: async () => {
        try {
            const form = document.getElementById('editCardForm');
            
            // Validate form
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const uid = document.getElementById('editCardUid').value;
            const name = document.getElementById('editCardName').value.trim();
            const enabled = document.getElementById('editCardEnabled').checked;
            const cacheable = document.getElementById('editCardCacheable').checked;
            const accessStart = document.getElementById('editCardAccessStart').value || null;
            const accessEnd = document.getElementById('editCardAccessEnd').value || null;
            const timeSlotsStr = document.getElementById('editCardTimeSlots').value.trim();
            const allowedDevicesStr = document.getElementById('editCardAllowedDevices').value.trim();
            
            // Parse time slots
            let timeSlots = null;
            if (timeSlotsStr) {
                try {
                    timeSlots = timeSlotsStr.split(',').map(s => s.trim()).filter(s => s);
                    // Validate format
                    const timeSlotRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])-([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
                    for (const slot of timeSlots) {
                        if (!timeSlotRegex.test(slot)) {
                            showToast(`时间段格式错误: ${slot}，应为 HH:MM-HH:MM`, 'danger');
                            return;
                        }
                    }
                } catch (e) {
                    showToast('时间段格式错误', 'danger');
                    return;
                }
            }
            
            // Parse allowed devices
            let allowedDevices = null;
            if (allowedDevicesStr) {
                allowedDevices = allowedDevicesStr.split(',').map(s => s.trim()).filter(s => s);
            }
            
            showLoading();
            
            const cardData = {
                name,
                enabled,
                cacheable,
                access_start: accessStart,
                access_end: accessEnd,
                time_slots: timeSlots,
                allowed_devices: allowedDevices,
            };
            
            const response = await API.updateCard(uid, cardData);
            
            if (response.success) {
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editCardModal'));
                modal.hide();
                
                // Reload cards list
                App.loadCardsData();
                
                showToast('卡片更新成功', 'success');
            } else {
                showToast(response.message || '卡片更新失败', 'danger');
            }
        } catch (error) {
            console.error('Failed to update card:', error);
            
            if (error.response && error.response.data) {
                showToast(error.response.data.message || '卡片更新失败', 'danger');
            } else {
                showToast('卡片更新失败，请稍后重试', 'danger');
            }
        } finally {
            hideLoading();
        }
    },

    /**
     * Delete Card
     */
    deleteCard: async (uid) => {
        if (!confirm(`确定要删除卡片 ${uid} 吗？此操作无法撤销！`)) {
            return;
        }
        
        try {
            showLoading();
            
            const response = await API.deleteCard(uid);
            
            if (response.success) {
                // Reload cards list
                App.loadCardsData();
                
                showToast('卡片删除成功', 'success');
            } else {
                showToast(response.message || '卡片删除失败', 'danger');
            }
        } catch (error) {
            console.error('Failed to delete card:', error);
            
            if (error.response && error.response.data) {
                showToast(error.response.data.message || '卡片删除失败', 'danger');
            } else {
                showToast('卡片删除失败，请稍后重试', 'danger');
            }
        } finally {
            hideLoading();
        }
    },

    /**
     * Show Add Device Modal
     */
    showAddDeviceModal: () => {
        // Reset form
        document.getElementById('addDeviceForm').reset();
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addDeviceModal'));
        modal.show();
    },

    /**
     * Submit Add Device Form
     */
    submitAddDevice: async () => {
        try {
            const form = document.getElementById('addDeviceForm');
            
            // Validate form
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const deviceId = document.getElementById('deviceId').value.trim();
            const name = document.getElementById('deviceName').value.trim();
            const location = document.getElementById('deviceLocation').value.trim();
            const macAddress = document.getElementById('deviceMac').value.trim();
            
            // Validate device ID format
            if (!/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
                showToast('设备ID格式不正确，只能包含字母、数字、下划线和连字符', 'danger');
                return;
            }
            
            // Validate MAC address format if provided
            if (macAddress && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(macAddress)) {
                showToast('MAC地址格式不正确，格式应为 XX:XX:XX:XX:XX:XX', 'danger');
                return;
            }
            
            showLoading();
            
            const deviceData = {
                device_id: deviceId,
                name: name,
                location: location || null,
                mac_address: macAddress || null,
            };
            
            const response = await API.addDevice(deviceData);
            
            if (response.success && response.data) {
                // Hide add device modal
                const addModal = bootstrap.Modal.getInstance(document.getElementById('addDeviceModal'));
                addModal.hide();
                
                // Show credentials modal
                App.showDeviceCredentials(response.data);
                
                // Reload devices list
                App.loadDevicesData();
                
                showToast('设备注册成功！请保存API密钥和Secret密钥', 'success');
            } else {
                showToast(response.message || '设备注册失败', 'danger');
            }
        } catch (error) {
            console.error('Failed to add device:', error);
            
            if (error.response && error.response.data) {
                showToast(error.response.data.message || '设备注册失败', 'danger');
            } else {
                showToast('设备注册失败，请稍后重试', 'danger');
            }
        } finally {
            hideLoading();
        }
    },

    /**
     * Show Device Credentials Modal
     */
    showDeviceCredentials: (deviceData) => {
        document.getElementById('credDeviceId').value = deviceData.device_id;
        document.getElementById('credDeviceName').value = deviceData.name;
        document.getElementById('credApiKey').value = deviceData.api_key;
        document.getElementById('credSecretKey').value = deviceData.secret_key;
        
        const modal = new bootstrap.Modal(document.getElementById('deviceCredentialsModal'));
        modal.show();
    },

    /**
     * Show Edit Device Modal
     */
    showEditDeviceModal: async (deviceId) => {
        try {
            showLoading();
            
            // Fetch device details
            const response = await API.getDevices();
            
            if (response.success && response.data) {
                const devices = response.data.devices || response.data;
                const device = devices.find(d => d.device_id === deviceId);
                
                if (!device) {
                    showToast('设备不存在', 'danger');
                    return;
                }
                
                // Populate form
                document.getElementById('editDeviceId').value = device.device_id;
                document.getElementById('editDeviceIdDisplay').value = device.device_id;
                document.getElementById('editDeviceName').value = device.name;
                document.getElementById('editDeviceLocation').value = device.location || '';
                document.getElementById('editDeviceMac').value = device.mac_address || '';
                document.getElementById('editDeviceEnabled').checked = device.enabled !== false;
                
                // Show modal
                const modal = new bootstrap.Modal(document.getElementById('editDeviceModal'));
                modal.show();
            }
        } catch (error) {
            console.error('Failed to load device details:', error);
            showToast('加载设备信息失败', 'danger');
        } finally {
            hideLoading();
        }
    },

    /**
     * Submit Edit Device Form
     */
    submitEditDevice: async () => {
        try {
            const form = document.getElementById('editDeviceForm');
            
            // Validate form
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const deviceId = document.getElementById('editDeviceId').value;
            const name = document.getElementById('editDeviceName').value.trim();
            const location = document.getElementById('editDeviceLocation').value.trim();
            const macAddress = document.getElementById('editDeviceMac').value.trim();
            const enabled = document.getElementById('editDeviceEnabled').checked;
            
            // Validate MAC address format if provided
            if (macAddress && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(macAddress)) {
                showToast('MAC地址格式不正确，格式应为 XX:XX:XX:XX:XX:XX', 'danger');
                return;
            }
            
            showLoading();
            
            const deviceData = {
                name: name,
                location: location || null,
                mac_address: macAddress || null,
                enabled: enabled,
            };
            
            const response = await API.updateDevice(deviceId, deviceData);
            
            if (response.success) {
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editDeviceModal'));
                modal.hide();
                
                // Reload devices list
                App.loadDevicesData();
                
                showToast('设备更新成功', 'success');
            } else {
                showToast(response.message || '设备更新失败', 'danger');
            }
        } catch (error) {
            console.error('Failed to update device:', error);
            
            if (error.response && error.response.data) {
                showToast(error.response.data.message || '设备更新失败', 'danger');
            } else {
                showToast('设备更新失败，请稍后重试', 'danger');
            }
        } finally {
            hideLoading();
        }
    },

    /**
     * Copy text to clipboard
     */
    copyToClipboard: (elementId) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.select();
        element.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            showToast('已复制到剪贴板', 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            showToast('复制失败，请手动复制', 'danger');
        }
    },
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
