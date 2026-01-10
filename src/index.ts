import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { chromium, Browser, Page } from "playwright";

// Create server instance
const server = new Server(
  {
    name: "web-reader",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize Turndown service (convert HTML to Markdown)
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Configure Turndown rules
turndownService.addRule("skipScripts", {
  filter: ["script", "style", "noscript"],
  replacement: () => "",
});

// Browser instance management
let browser: Browser | null = null;

// Get or create browser instance
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',  // Disable automation detection
        '--disable-infobars',
        '--window-size=1920,1080',
        '--start-maximized',
      ],
    });
  }
  return browser;
}

// Clean up browser instance
async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// URL validation function
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Check if it's a WeChat article link
function isWeixinUrl(url: string): boolean {
  return url.includes('mp.weixin.qq.com') || url.includes('weixin.qq.com');
}

// Check if browser mode is needed
function shouldUseBrowser(error: Error, statusCode?: number, content?: string): boolean {
  const errorMessage = error.message.toLowerCase();

  // Based on HTTP status codes
  if (statusCode && [403, 429, 503, 520, 521, 522, 523, 524].includes(statusCode)) {
    return true;
  }

  // Based on error messages
  const browserTriggers = [
    'cloudflare',
    'access denied',
    'forbidden',
    'captcha',
    'rate limit',
    'robot',
    'security',
    'blocked',
    'protection',
    'verification required',
    'environment anomaly',
    'verify'
  ];

  if (browserTriggers.some(trigger => errorMessage.includes(trigger))) {
    return true;
  }

  // Based on response content
  if (content) {
    const contentLower = content.toLowerCase();
    const contentTriggers = [
      'cloudflare',
      'ray id',
      'access denied',
      'security check',
      'human verification',
      'captcha',
      // WeChat-specific verification keywords
      'environment anomaly',
      'verify',
      'complete verification to continue',
      'verify'
    ];

    if (contentTriggers.some(trigger => contentLower.includes(trigger))) {
      return true;
    }
  }

  return false;
}

// Fetch content using Jina Reader
async function fetchWithJinaReader(url: string): Promise<{
  title: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: string;
    contentLength: number;
    method: string;
  };
}> {
  try {
    // Jina Reader API URL
    const jinaUrl = `https://r.jina.ai/${url}`;

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/markdown",
        "User-Agent": "MCP-URLFetcher/2.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Jina Reader API error! status: ${response.status}`);
    }

    const markdown = await response.text();

    // Extract title from Markdown (usually the first # heading)
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : "No title";

    return {
      title,
      content: markdown,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
        contentLength: markdown.length,
        method: "jina-reader",
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Jina Reader request timeout (30s)`);
      }
      throw new Error(`Jina Reader fetch failed: ${error.message}`);
    }
    throw new Error(`Jina Reader fetch failed: ${String(error)}`);
  }
}

// Fetch web content using Playwright
async function fetchWithPlaywright(url: string): Promise<{
  title: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: string;
    contentLength: number;
    method: string;
  };
}> {
  let page: Page | null = null;
  const isWeixin = isWeixinUrl(url);

  try {
    const browserInstance = await getBrowser();
    page = await browserInstance.newPage();

    // Set real User-Agent (simulate Chrome on Mac)
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setExtraHTTPHeaders({
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(isWeixin ? { 'Referer': 'https://mp.weixin.qq.com/' } : {}),
    });

    await page.setViewportSize({ width: 1920, height: 1080 });

    // WeChat articles need to load styles for correct rendering, filter for other sites
    if (!isWeixin) {
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    // Navigate to page with longer timeout
    await page.goto(url, {
      timeout: 45000,
      waitUntil: 'networkidle'  // Wait for network idle to ensure JS execution
    });

    // WeChat articles need longer wait time
    const waitTime = isWeixin ? 5000 : 2000;
    await page.waitForTimeout(waitTime);

    // Get page title
    const title = await page.title() || "No title";

    // Remove unwanted elements
    await page.evaluate(() => {
      const elementsToRemove = document.querySelectorAll(
        'script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar, .comments, .social-share'
      );
      elementsToRemove.forEach(el => el.remove());
    });

    // Get main content (WeChat articles have specific DOM structure)
    const htmlContent = await page.evaluate(() => {
      // WeChat article specific selectors
      const weixinContent = document.querySelector('#js_content') ||
                            document.querySelector('.rich_media_content');
      if (weixinContent) {
        return weixinContent.innerHTML;
      }

      // Common selectors
      const mainContent =
        document.querySelector('main') ||
        document.querySelector('article') ||
        document.querySelector('[role="main"]') ||
        document.querySelector('.content') ||
        document.querySelector('#content') ||
        document.querySelector('.post') ||
        document.querySelector('.entry-content') ||
        document.body;

      return mainContent ? mainContent.innerHTML : document.body.innerHTML;
    });

    // Convert to Markdown
    const markdown = turndownService.turndown(htmlContent);

    // Clean content
    const cleanedContent = markdown
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+$/gm, "")
      .trim();

    return {
      title,
      content: cleanedContent,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
        contentLength: cleanedContent.length,
        method: "playwright-browser",
      },
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Playwright fetch failed: ${error.message}`);
    }
    throw new Error(`Playwright fetch failed: ${String(error)}`);
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// Local web content extraction function
async function fetchWithLocalParser(url: string): Promise<{
  title: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: string;
    contentLength: number;
    method: string;
  };
}> {
  try {
    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Send HTTP request
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MCP-URLFetcher/2.0)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get HTML content
    const html = await response.text();

    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Get title
    const title = document.querySelector("title")?.textContent || "No title";

    // Remove unwanted elements
    const elementsToRemove = document.querySelectorAll(
      "script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar, .comments"
    );
    elementsToRemove.forEach(el => el.remove());

    // Get main content area
    const mainContent =
      document.querySelector("main") ||
      document.querySelector("article") ||
      document.querySelector('[role="main"]') ||
      document.querySelector(".content") ||
      document.querySelector("#content") ||
      document.querySelector(".post") ||
      document.querySelector(".entry-content") ||
      document.body;

    // Convert to Markdown
    const markdown = turndownService.turndown(mainContent.innerHTML);

    // Clean extra whitespace
    const cleanedContent = markdown
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+$/gm, "")
      .trim();

    return {
      title,
      content: cleanedContent,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
        contentLength: cleanedContent.length,
        method: "local-parser",
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Local parser request timeout (30s)`);
      }
      throw new Error(`Local parser failed: ${error.message}`);
    }
    throw new Error(`Local parser failed: ${String(error)}`);
  }
}

// Smart web content fetching (three-tier fallback: Jina → Local → Playwright)
// For known sites requiring browser (like WeChat), use browser mode directly
async function fetchWebContent(url: string, preferJina: boolean = true): Promise<{
  title: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: string;
    contentLength: number;
    method: string;
  };
}> {
  // WeChat articles use browser mode directly as other methods cannot bypass verification
  if (isWeixinUrl(url)) {
    console.error("Detected WeChat article, using Playwright browser mode");
    return await fetchWithPlaywright(url);
  }

  if (preferJina) {
    // Tier 1: Try Jina Reader
    try {
      return await fetchWithJinaReader(url);
    } catch (jinaError) {
      console.error("Jina Reader failed, trying local parser:", jinaError instanceof Error ? jinaError.message : String(jinaError));

      // Tier 2: Try local parser
      try {
        return await fetchWithLocalParser(url);
      } catch (localError) {
        console.error("Local parser failed, checking if browser mode needed:", localError instanceof Error ? localError.message : String(localError));

        // Check if browser mode is needed
        const jinaErr = jinaError instanceof Error ? jinaError : new Error(String(jinaError));
        const localErr = localError instanceof Error ? localError : new Error(String(localError));

        if (shouldUseBrowser(jinaErr) || shouldUseBrowser(localErr)) {
          console.error("Detected access restrictions, using Playwright browser mode");
          try {
            // Tier 3: Use Playwright browser
            return await fetchWithPlaywright(url);
          } catch (browserError) {
            throw new Error(
              `All methods failed. Jina: ${jinaErr.message}, Local: ${localErr.message}, Browser: ${browserError instanceof Error ? browserError.message : String(browserError)}`
            );
          }
        } else {
          throw new Error(
            `Jina and local parser both failed. Jina: ${jinaErr.message}, Local: ${localErr.message}`
          );
        }
      }
    }
  } else {
    // If not prioritizing Jina, start with local parser
    try {
      return await fetchWithLocalParser(url);
    } catch (localError) {
      const localErr = localError instanceof Error ? localError : new Error(String(localError));

      if (shouldUseBrowser(localErr)) {
        console.error("Local parser failed, detected access restrictions, using Playwright browser mode");
        return await fetchWithPlaywright(url);
      } else {
        throw localErr;
      }
    }
  }
}

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetch_url",
        description: "Fetch web content from specified URL and convert to Markdown format. Uses Jina Reader by default, automatically falls back to local parser on failure",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Webpage URL to fetch (must be http or https protocol)",
            },
            preferJina: {
              type: "boolean",
              description: "Whether to prioritize Jina Reader (default: true)",
              default: true,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_multiple_urls",
        description: "Batch fetch web content from multiple URLs",
        inputSchema: {
          type: "object",
          properties: {
            urls: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of webpage URLs to fetch",
              maxItems: 10, // Limit to 10 URLs
            },
            preferJina: {
              type: "boolean",
              description: "Whether to prioritize Jina Reader (default: true)",
              default: true,
            },
          },
          required: ["urls"],
        },
      },
      {
        name: "fetch_url_with_jina",
        description: "Force fetch using Jina Reader (suitable for complex webpages)",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Webpage URL to fetch",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_url_local",
        description: "Force fetch using local parser (suitable for simple webpages or when Jina is unavailable)",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Webpage URL to fetch",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_url_with_browser",
        description: "Force fetch using Playwright browser (suitable for websites with access restrictions, such as Cloudflare protection, CAPTCHA, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Webpage URL to fetch",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// Handle tool call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "fetch_url") {
      const { url, preferJina = true } = args as { url: string; preferJina?: boolean };

      // Validate URL
      if (!isValidUrl(url)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid URL format, please provide http or https protocol URL"
        );
      }

      // Fetch web content
      const result = await fetchWebContent(url, preferJina);

      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\n**URL**: ${result.metadata.url}\n**Fetched At**: ${result.metadata.fetchedAt}\n**Content Length**: ${result.metadata.contentLength} characters\n**Method**: ${result.metadata.method}\n\n---\n\n${result.content}`,
          },
        ],
      };
    } else if (name === "fetch_url_with_jina") {
      const { url } = args as { url: string };

      if (!isValidUrl(url)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid URL format"
        );
      }

      const result = await fetchWithJinaReader(url);

      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\n**URL**: ${result.metadata.url}\n**Fetched At**: ${result.metadata.fetchedAt}\n**Content Length**: ${result.metadata.contentLength} characters\n**Method**: Jina Reader\n\n---\n\n${result.content}`,
          },
        ],
      };
    } else if (name === "fetch_url_local") {
      const { url } = args as { url: string };

      if (!isValidUrl(url)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid URL format"
        );
      }

      const result = await fetchWithLocalParser(url);

      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\n**URL**: ${result.metadata.url}\n**Fetched At**: ${result.metadata.fetchedAt}\n**Content Length**: ${result.metadata.contentLength} characters\n**Method**: Local Parser\n\n---\n\n${result.content}`,
          },
        ],
      };
    } else if (name === "fetch_multiple_urls") {
      const { urls, preferJina = true } = args as { urls: string[]; preferJina?: boolean };

      // Validate all URLs
      const invalidUrls = urls.filter(url => !isValidUrl(url));
      if (invalidUrls.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `The following URLs have invalid format: ${invalidUrls.join(", ")}`
        );
      }

      // Fetch all URLs concurrently
      const results = await Promise.allSettled(
        urls.map(url => fetchWebContent(url, preferJina))
      );

      // Combine results
      let combinedContent = "# Batch URL Content Fetch Results\n\n";

      results.forEach((result, index) => {
        const url = urls[index];
        combinedContent += `## ${index + 1}. ${url}\n\n`;

        if (result.status === "fulfilled") {
          const { title, content, metadata } = result.value;
          combinedContent += `**Title**: ${title}\n`;
          combinedContent += `**Fetched At**: ${metadata.fetchedAt}\n`;
          combinedContent += `**Content Length**: ${metadata.contentLength} characters\n`;
          combinedContent += `**Method**: ${metadata.method}\n\n`;
          combinedContent += `### Content\n\n${content}\n\n`;
        } else {
          combinedContent += `**Error**: ${result.reason}\n\n`;
        }

        combinedContent += "---\n\n";
      });

      return {
        content: [
          {
            type: "text",
            text: combinedContent,
          },
        ],
      };
    } else if (name === "fetch_url_with_browser") {
      const { url } = args as { url: string };

      if (!isValidUrl(url)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid URL format"
        );
      }

      const result = await fetchWithPlaywright(url);

      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\n**URL**: ${result.metadata.url}\n**Fetched At**: ${result.metadata.fetchedAt}\n**Content Length**: ${result.metadata.contentLength} characters\n**Method**: Playwright Browser\n\n---\n\n${result.content}`,
          },
        ],
      };
    } else {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Web Reader v2.0 started (with Jina Reader + Playwright support)");
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.error("Received SIGINT signal, closing browser...");
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error("Received SIGTERM signal, closing browser...");
  await closeBrowser();
  process.exit(0);
});

main().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});