#!/bin/bash
# MCP Web Reader - npm 发布脚本

echo "🚀 MCP Web Reader npm 发布脚本"
echo "=================================="

# 检查是否已登录 npm
echo "📋 检查 npm 登录状态..."
if npm whoami > /dev/null 2>&1; then
    echo "✅ 已登录 npm 用户: $(npm whoami)"
else
    echo "❌ 未登录 npm，请先运行: npm login"
    exit 1
fi

# 检查包状态
echo ""
echo "📋 检查包状态..."
CURRENT_USER=$(npm whoami)
if npm view mcp-web-reader > /dev/null 2>&1; then
    # 包存在，检查是否是维护者
    MAINTAINERS=$(npm view mcp-web-reader maintainers --json 2>/dev/null | jq -r '.[].name' 2>/dev/null || echo "")
    if echo "$MAINTAINERS" | grep -q "^${CURRENT_USER}$"; then
        echo "✅ 包 'mcp-web-reader' 已存在，你是维护者，可以发布新版本"
    else
        echo "⚠️  包名 'mcp-web-reader' 已被其他用户占用"
        echo "当前维护者: $MAINTAINERS"
        echo "请考虑更改包名 (修改 package.json 中的 name 字段)"
        exit 1
    fi
else
    echo "✅ 包名 'mcp-web-reader' 可用，可以发布"
fi

# 显示包信息
echo ""
echo "📦 包信息:"
npm pack --dry-run | grep -E "(name|version|package size|total files)"

# 确认发布
echo ""
echo "⚠️  即将发布到 npm，这将使包对所有人可用"
read -p "是否继续发布? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消发布"
    exit 0
fi

# 发布包
echo ""
echo "📤 正在发布包到 npm..."
if npm publish; then
    echo ""
    echo "🎉 发布成功!"
    echo "📦 包名: mcp-web-reader"
    echo "🏷️  版本: $(node -p "require('./package.json').version")"
    echo "📖 安装方法:"
    echo "   npm install -g mcp-web-reader"
    echo ""
    echo "🔗 包页面: https://www.npmjs.com/package/mcp-web-reader"
else
    echo ""
    echo "❌ 发布失败，请检查错误信息"
    exit 1
fi