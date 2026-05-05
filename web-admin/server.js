#!/usr/bin/env node
/**
 * Simple HTTP Server for Web Admin
 * 为Web管理界面提供静态文件服务
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// MIME类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 解析请求路径
  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  // 移除查询参数
  filePath = filePath.split('?')[0];
  
  // 构建完整文件路径
  const fullPath = path.join(__dirname, filePath);
  
  // 获取文件扩展名
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  // 记录请求
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 读取并返回文件
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // 文件不存在，返回404
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
        console.error(`  → 404 Not Found: ${fullPath}`);
      } else {
        // 服务器错误
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 Internal Server Error</h1>');
        console.error(`  → 500 Error: ${err.message}`);
      }
    } else {
      // 成功返回文件
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(data);
      console.log(`  → 200 OK (${contentType})`);
    }
  });
});

// 启动服务器
server.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log('  Web Admin Server Started');
  console.log('='.repeat(60));
  console.log(`  Server running at: http://${HOST}:${PORT}`);
  console.log(`  Local access:      http://localhost:${PORT}`);
  console.log(`  Environment:       ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Root directory:    ${__dirname}`);
  console.log('='.repeat(60));
  console.log('  Press Ctrl+C to stop the server');
  console.log('='.repeat(60));
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
