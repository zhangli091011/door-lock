/**
 * PM2 生态系统配置文件
 * 用于管理后端和前端服务
 * 
 * 使用方法:
 * pm2 start ecosystem.config.js
 * pm2 stop all
 * pm2 restart all
 * pm2 logs
 */

module.exports = {
  apps: [
    {
      name: 'nfc-backend',
      cwd: './server',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'nfc-web-admin',
      cwd: './web-admin',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        PORT: 8080
      },
      error_file: './logs/web-admin-error.log',
      out_file: './logs/web-admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
