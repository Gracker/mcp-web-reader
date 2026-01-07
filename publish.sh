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

# 检查包名是否可用
echo ""
echo "📋 检查包名可用性..."
if npm view mcp-web-reader > /dev/null 2>&1; then
    echo "⚠️  包名 'mcp-web-reader' 已被占用"
    echo "请考虑以下选项:"
    echo "1. 联系现有包维护者"
    echo "2. 更改包名 (修改 package.json 中的 name 字段)"
    exit 1
else
    echo "✅ 包名 'mcp-web-reader' 可用"
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
    echo "🏷️  版本: 2.0.0"
    echo "📖 安装方法:"
    echo "   npm install -g mcp-web-reader"
    echo ""
    echo "🔗 包页面: https://www.npmjs.com/package/mcp-web-reader"
else
    echo ""
    echo "❌ 发布失败，请检查错误信息"
    exit 1
fi