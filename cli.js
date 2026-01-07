#!/usr/bin/env node
/**
 * MCP Web Reader 命令行工具
 * 
 * 用法:
 *   node cli.js fetch <url>      - 智能获取（自动降级）
 *   node cli.js jina <url>        - 强制使用 Jina Reader
 *   node cli.js local <url>       - 强制使用本地解析
 *   node cli.js browser <url>     - 强制使用浏览器模式
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_PATH = join(__dirname, 'dist', 'index.js');

const command = process.argv[2];
const url = process.argv[3];

if (!command || !url) {
  console.log(`
用法: node cli.js <command> <url>

命令:
  fetch    - 智能获取（自动降级：Jina → 本地 → 浏览器）
  jina     - 强制使用 Jina Reader
  local    - 强制使用本地解析器
  browser  - 强制使用浏览器模式（适用于受限网站）

示例:
  node cli.js fetch https://example.com
  node cli.js browser https://mp.weixin.qq.com/...
  node cli.js jina https://example.com
  `);
  process.exit(1);
}

const toolMap = {
  'fetch': 'fetch_url',
  'jina': 'fetch_url_with_jina',
  'local': 'fetch_url_local',
  'browser': 'fetch_url_with_browser'
};

const toolName = toolMap[command];
if (!toolName) {
  console.error(`❌ 未知命令: ${command}`);
  console.error(`可用命令: ${Object.keys(toolMap).join(', ')}`);
  process.exit(1);
}

// 验证 URL
try {
  new URL(url);
} catch (e) {
  console.error(`❌ 无效的 URL: ${url}`);
  process.exit(1);
}

console.log(`🚀 启动 MCP Web Reader...`);
console.log(`📋 工具: ${toolName}`);
console.log(`🌐 URL: ${url}\n`);

// 启动 MCP 服务器
const server = spawn('node', [SERVER_PATH], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 0;
let initialized = false;
let toolCalled = false;

// 发送请求
function sendRequest(method, params) {
  const id = ++requestId;
  const request = {
    jsonrpc: '2.0',
    id: id,
    method: method,
    params: params
  };
  server.stdin.write(JSON.stringify(request) + '\n');
  return id;
}

// 处理响应
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      
      // 处理初始化响应（id === 1）
      if (response.id === 1 && response.result) {
        initialized = true;
        // 初始化完成后，获取工具列表（可选），然后调用工具
        setTimeout(() => {
          if (!toolCalled) {
            toolCalled = true;
            const args = toolName === 'fetch_url' 
              ? { url, preferJina: true }
              : { url };
              
            console.log(`⏳ 正在获取网页内容...\n`);
            sendRequest('tools/call', {
              name: toolName,
              arguments: args
            });
          }
        }, 100);
        return;
      }
      
      // 处理工具调用响应（id > 1）
      if (response.id > 1) {
        if (response.result && response.result.content) {
          const content = response.result.content[0];
          if (content.type === 'text') {
            console.log(content.text);
            console.log('\n✅ 完成！');
            clearTimeout(timeout);
            server.kill();
            process.exit(0);
          }
        }
        
        // 处理错误
        if (response.error) {
          console.error('❌ 错误:', response.error.message);
          if (response.error.data) {
            console.error('详情:', JSON.stringify(response.error.data, null, 2));
          }
          clearTimeout(timeout);
          server.kill();
          process.exit(1);
        }
      }
    } catch (e) {
      // 忽略非 JSON 行
    }
  });
});

// 监听日志（stderr）
server.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message && !message.includes('已启动')) {
    // 可以选择显示详细日志
    // process.stderr.write(data);
  }
});

// 初始化
sendRequest('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { 
    name: 'mcp-web-reader-cli', 
    version: '1.0.0' 
  }
});

// 超时处理（60秒）
const timeout = setTimeout(() => {
  console.error('\n❌ 请求超时（60秒）');
  server.kill();
  process.exit(1);
}, 60000);

// 清理超时
process.on('exit', () => {
  clearTimeout(timeout);
});

// 错误处理
server.on('error', (error) => {
  console.error('❌ 服务器错误:', error.message);
  clearTimeout(timeout);
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n⚠️  中断请求');
  server.kill();
  clearTimeout(timeout);
  process.exit(0);
});

