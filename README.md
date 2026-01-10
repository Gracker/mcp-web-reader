# MCP Web Reader

A powerful MCP (Model Context Protocol) server that enables Claude and other LLMs to read and parse web content. Bypasses access restrictions for WeChat articles, paywalled sites, and Cloudflare-protected pages.

[简体中文](./README_CN.md)

## Features

- 🚀 **Multi-engine**: Jina Reader API, local parser, and Playwright browser
- 🔄 **Smart fallback**: Auto-switches Jina → Local → Playwright browser
- 🌐 **Bypass restrictions**: Cloudflare, CAPTCHAs, access controls
- 📦 **Batch processing**: Fetch multiple URLs simultaneously
- 📝 **Markdown output**: Automatic conversion to clean Markdown

## Installation

```bash
npm install -g mcp-web-reader
```

> **Note**: Chromium browser (~100-200MB) will be automatically downloaded. This is required for:
> - WeChat articles (need browser rendering)
> - Cloudflare-protected sites
> - JavaScript-heavy sites
> - CAPTCHA/access restrictions

Download may take 1-5 minutes depending on network speed.

### From Source

```bash
git clone https://github.com/Gracker/mcp-web-reader.git
cd mcp-web-reader
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your config file:

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

## Usage

In Claude:
- "Fetch content from https://example.com"
- "Get content using browser for https://mp.weixin.qq.com/..."
- "Fetch multiple URLs: [url1, url2, url3]"

## Supported Sites

- WeChat articles (mp.weixin.qq.com)
- Paywalled sites (NYT, Time Magazine, etc.)
- Cloudflare-protected sites
- JavaScript-heavy sites
- CAPTCHA-protected sites

## Tools

- `fetch_url` - Smart fetching with automatic fallback
- `fetch_url_with_jina` - Force Jina Reader
- `fetch_url_local` - Force local parsing
- `fetch_url_with_browser` - Force browser mode (for restricted sites)
- `fetch_multiple_urls` - Batch URL fetching

## Architecture

Intelligent fallback:
```
URL Request → Jina Reader → Local Parser → Playwright Browser
```

Auto-detects restrictions and switches to browser for:
- HTTP status codes: 403, 429, 503, 520-524
- Keywords: Cloudflare, CAPTCHA, Access Denied
- Content patterns: Security checks, human verification

## Development

```bash
npm run dev    # Development with auto-rebuild
npm run build  # Build production version
npm start      # Test run
```

## License

MIT License
