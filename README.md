# MCP Web Reader

一个强大的 MCP (Model Context Protocol) 服务器，让 Claude 和其他大语言模型能够读取和解析网页内容。支持突破访问限制，轻松获取微信文章、时代杂志等受保护内容。

## 功能特点

- 🚀 **三引擎支持**：集成 Jina Reader API、本地解析器和 Playwright 浏览器
- 🔄 **智能降级**：Jina Reader → 本地解析 → Playwright 浏览器三层自动切换
- 🌐 **突破限制**：使用 Playwright 处理 Cloudflare、验证码等访问限制
- 📦 **批量处理**：支持同时获取多个 URL
- 🎯 **灵活控制**：可选择强制使用特定解析方式
- 📝 **Markdown 输出**：自动转换为清晰的 Markdown 格式

## 安装

### 方法 1：从源码安装

```bash
# 克隆仓库
git clone https://github.com/zacfire/mcp-web-reader.git
cd mcp-web-reader

# 安装依赖
npm install

# 构建项目
npm run build

# 安装 Playwright 浏览器（必需）
npx playwright install chromium
```

### 方法 2：使用 npm 安装（推荐）

发布后，您可以简单地通过 npm 安装：

```bash
npm install -g mcp-web-reader
```

**首次发布步骤**：
如果这是第一次发布，请运行提供的发布脚本：

```bash
# 确保已登录 npm
npm login

# 运行发布脚本
./publish.sh
```

## 配置

### 快速配置

在 Claude Desktop 的配置文件中添加：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "web-reader": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-web-reader/dist/index.js"]
    }
  }
}
```

**重要**: 将 `/absolute/path/to/mcp-web-reader/dist/index.js` 替换为你的实际路径。

### 详细配置指南

📖 **完整的使用指南**：请查看 [USAGE_GUIDE.md](./USAGE_GUIDE.md)，包含：
- **命令行使用（推荐）** - 适合使用 CLI 的用户
- Claude Desktop 配置
- Claude Code (Cursor) 配置
- 其他 MCP 客户端配置
- 使用示例和故障排除

📖 **命令行专用指南**：请查看 [CLI_USAGE.md](./CLI_USAGE.md)，包含：
- 使用 MCP Inspector 测试
- 创建 CLI 包装器
- 集成到自定义脚本
- 命令行工具使用示例

## 使用方法

### 命令行使用（推荐）

如果你主要使用命令行的 Claude，可以使用提供的 CLI 工具：

```bash
# 智能获取（自动降级）
node cli.js fetch https://example.com

# 强制使用 Jina Reader
node cli.js jina https://example.com

# 强制使用本地解析
node cli.js local https://example.com

# 强制使用浏览器模式（适用于微信文章等受限网站）
node cli.js browser https://mp.weixin.qq.com/...
```

或者使用 MCP Inspector 进行交互式测试：

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

📖 详细说明请查看 [CLI_USAGE.md](./CLI_USAGE.md)

### 在 Claude 中使用

配置完成后，在 Claude 中可以使用以下命令：

1.  **智能获取（推荐）**
    * "请获取 [https://example.com](https://example.com) 的内容"
    * 自动三层降级：Jina Reader → 本地解析 → Playwright 浏览器

2.  **批量获取**
    * "请获取这些网页：[url1, url2, url3]"
    * 每个URL都享受智能降级策略

3.  **强制使用 Jina Reader**
    * "使用 Jina Reader 获取 [https://example.com](https://example.com)"

4.  **强制使用本地解析**
    * "使用本地解析器获取 [https://example.com](https://example.com)"

5.  **强制使用浏览器模式**
    * "使用浏览器获取 [https://example.com](https://example.com)"
    * 直接跳过其他方式，适用于确定有访问限制的网站

## 支持的受限网站类型

✅ **微信公众号文章** - 自动绕过访问限制  
✅ **时代杂志、纽约时报** - 突破付费墙和地区限制  
✅ **Cloudflare 保护网站** - 通过真实浏览器绕过检测  
✅ **需要 JavaScript 渲染的页面** - 完整执行页面脚本  
✅ **有验证码/人机验证的网站** - 模拟真实用户行为

## 工具列表

-   `fetch_url` - 智能获取（三层降级：Jina → 本地 → Playwright）
-   `fetch_url_with_jina` - 强制使用 Jina Reader
-   `fetch_url_local` - 强制使用本地解析器  
-   `fetch_url_with_browser` - 强制使用 Playwright 浏览器（突破访问限制）
-   `fetch_multiple_urls` - 批量获取多个 URL

## 技术架构

### 智能降级策略
```
用户请求 URL
    ↓
1. Jina Reader API (最快，成功率高)
    ↓ 失败
2. 本地解析器 (Node.js + JSDOM)
    ↓ 检测到访问限制
3. Playwright 浏览器 (真实浏览器，突破限制)
```

### 访问限制检测
自动识别以下情况并启用浏览器模式：
- HTTP 状态码：403, 429, 503, 520-524
- 错误关键词：Cloudflare, CAPTCHA, Access Denied, Rate Limit
- 内容关键词：Security Check, Human Verification

## 开发

```bash
# 开发模式（自动重新编译）
npm run dev

# 构建
npm run build

# 测试运行
npm start

# 安装浏览器二进制文件（首次使用必需）
npx playwright install chromium
```

## 性能优化

- ⚡ **浏览器实例复用** - 避免重复启动开销
- 🚫 **资源过滤** - 阻止图片、样式表等不必要加载
- 🎯 **智能选择** - 优先使用快速方法，必要时才用浏览器
- 💾 **优雅关闭** - 正确清理浏览器资源

## 验证安装

### 测试 MCP 服务器

1. **使用 MCP Inspector 测试**：
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

2. **测试工具功能**：
在 Inspector 中输入以下 JSON 测试各种工具：
```json
{"method": "tools/call", "params": {"name": "fetch_url", "arguments": {"url": "https://example.com"}}}
```

### 在 Claude Desktop 中验证

配置完成后，重启 Claude Desktop，然后在对话中输入：
- "请获取 https://httpbin.org/json 的内容"

如果能成功返回内容，说明安装成功。

## 故障排除

### 常见问题

1. **"找不到模块" 错误**
   - 确保已运行 `npm install`
   - 确保已运行 `npm run build`

2. **Claude Desktop 无法连接到 MCP 服务器**
   - 检查配置文件路径是否正确
   - 检查 `dist/index.js` 路径是否正确
   - 重启 Claude Desktop

3. **Playwright 浏览器相关错误**
   - 确保已运行 `npx playwright install chromium`
   - 检查系统是否支持图形界面（某些服务器环境可能需要额外配置）

4. **微信文章无法获取**
   - 微信文章需要 Playwright 浏览器模式
   - 使用 `fetch_url_with_browser` 工具强制使用浏览器

### 调试模式

启用详细日志：
```bash
DEBUG=* node dist/index.js
```

## 贡献

欢迎提交 Pull Request！

## 许可证

MIT License

