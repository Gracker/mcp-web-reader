# MCP Web Reader

强大的 MCP（Model Context Protocol）服务器，让 Claude 和其他 LLM 能够读取和解析网页内容。支持绕过微信文章、付费网站和 Cloudflare 保护页面的访问限制。

[English](./README.md)

## 功能特性

- 🚀 **多引擎支持**: Jina Reader API、本地解析器和 Playwright 浏览器
- 🔄 **智能降级**: 自动切换 Jina → 本地 → Playwright 浏览器
- 🌐 **绕过限制**: Cloudflare、验证码、访问控制
- 📦 **批量处理**: 同时获取多个 URL
- 📝 **Markdown 输出**: 自动转换为清晰的 Markdown 格式

## 安装

```bash
npm install -g mcp-web-reader
```

> **注意**: 会自动下载 Chromium 浏览器（约 100-200MB），这是必需的：
> - 微信文章（需要浏览器渲染）
> - Cloudflare 保护网站
> - JavaScript 密集型网站
> - 验证码/访问限制

下载过程可能需要 1-5 分钟，取决于网络速度。

### 从源码安装

```bash
git clone https://github.com/Gracker/mcp-web-reader.git
cd mcp-web-reader
npm install
npm run build
```

## 配置

### Claude Desktop

添加到配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "web-reader": {
      "command": "mcp-web-reader"
    }
  }
}
```

### Claude Code

```bash
claude mcp add web-reader -- mcp-web-reader
claude mcp list
```

## 使用方法

在 Claude 中：
- "获取 https://example.com 的内容"
- "用浏览器获取 https://mp.weixin.qq.com/... 的内容"
- "批量获取这些 URL：[url1, url2, url3]"

## 支持的网站

- 微信公众号文章（mp.weixin.qq.com）
- 付费网站（纽约时报、时代杂志等）
- Cloudflare 保护网站
- JavaScript 密集型网站
- 需要验证码的网站

## 工具

- `fetch_url` - 智能获取（自动降级）
- `fetch_url_with_jina` - 强制使用 Jina Reader
- `fetch_url_local` - 强制使用本地解析
- `fetch_url_with_browser` - 强制使用浏览器模式（受限网站）
- `fetch_multiple_urls` - 批量获取

## 架构

智能降级策略：
```
URL Request → Jina Reader → Local Parser → Playwright Browser
```

自动检测限制并切换到浏览器：
- HTTP 状态码: 403, 429, 503, 520-524
- 关键词: Cloudflare, CAPTCHA, Access Denied
- 内容模式: 安全检查、人机验证

## 开发

```bash
npm run dev    # 开发模式（自动重编译）
npm run build  # 构建生产版本
npm start      # 测试运行
```

## 许可证

MIT License
