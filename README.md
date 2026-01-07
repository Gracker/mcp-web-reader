# MCP Web Reader

A powerful MCP (Model Context Protocol) server that enables Claude and other LLMs to read and parse web content. Supports bypassing access restrictions to easily fetch protected content like WeChat articles and paywalled sites.

## Features

- 🚀 **Multi-engine support**: Jina Reader API, local parser, and Playwright browser
- 🔄 **Intelligent fallback**: Auto-switches from Jina → Local → Playwright browser
- 🌐 **Bypass restrictions**: Handles Cloudflare, CAPTCHAs, and access controls
- 📦 **Batch processing**: Fetch multiple URLs simultaneously
- 🎯 **Flexible control**: Force specific parsing methods when needed
- 📝 **Markdown output**: Automatic conversion to clean Markdown format

## Installation

### Quick Install (Recommended)

```bash
npm install -g mcp-web-reader
```

### Install from Source

```bash
git clone https://github.com/Gracker/mcp-web-reader.git
cd mcp-web-reader
npm install
npm run build
npx playwright install chromium
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config file:

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

### Claude Code (Terminal)

For Claude Code users, add the MCP server using the command line:

```bash
claude mcp add web-reader -- mcp-web-reader
```

To verify the server is configured:
```bash
claude mcp list
```

## Usage

### In Claude

After configuration, use natural language commands:

- "Fetch content from https://example.com"
- "Get content using browser for https://mp.weixin.qq.com/..." (for restricted sites)
- "Fetch multiple URLs: [url1, url2, url3]"

## Supported Sites

- **WeChat articles** - Automatic access bypass
- **Paywalled sites** - NYT, Time Magazine, etc.
- **Cloudflare protected sites**
- **JavaScript-heavy sites**
- **CAPTCHA protected sites**

## Tools

- `fetch_url` - Smart fetching with automatic fallback
- `fetch_url_with_jina` - Force Jina Reader
- `fetch_url_local` - Force local parsing
- `fetch_url_with_browser` - Force browser mode (for restricted sites)
- `fetch_multiple_urls` - Batch URL fetching

## Architecture

Intelligent fallback strategy:
```
URL Request → Jina Reader → Local Parser → Playwright Browser
```

Auto-detects restrictions and switches to browser mode for:
- HTTP status codes: 403, 429, 503, 520-524
- Keywords: Cloudflare, CAPTCHA, Access Denied
- Content patterns: Security checks, human verification

## Development

```bash
npm run dev    # Development mode with auto-rebuild
npm run build  # Build production version
npm start      # Test run
npx playwright install chromium  # Install browser (required)
```

## License

MIT License

