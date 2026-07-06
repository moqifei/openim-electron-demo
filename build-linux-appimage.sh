#!/bin/bash

# OpenCorp Linux AppImage Packager Script
# AppImage可以捆绑自己的libc，不依赖目标系统的GLIBC版本
# 支持架构: x64 (amd64), arm64

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 默认架构为 x64，可以通过参数指定
ARCH=${1:-x64}

# 验证架构参数
if [[ "$ARCH" != "x64" && "$ARCH" != "arm64" ]]; then
    echo "错误: 不支持的架构 '$ARCH'"
    echo "用法: $0 [x64|arm64]"
    echo "示例: $0 x64   # 打包 x86_64 AppImage"
    echo "      $0 arm64 # 打包 ARM64 AppImage"
    exit 1
fi

echo "=========================================="
echo "OpenCorp Linux AppImage Packager (架构: $ARCH)"
echo "=========================================="

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "错误: 未找到 node_modules 目录"
    echo "请先运行: npm install"
    exit 1
fi

# 清理之前的构建
echo "清理之前的构建..."
rm -rf release dist dist-electron

# 构建前端和 Electron
echo "构建前端和 Electron (架构: $ARCH)..."
npm run build

# 获取版本号
VERSION=$(node -p "require('./package.json').version")
PRODUCT_NAME="OpenCorp-Base"

echo "准备打包 AppImage..."

# 根据架构设置 electron-builder 参数
if [ "$ARCH" = "x64" ]; then
    echo "执行构建命令: npm run build:linux-appimage"
    npm run build:linux-appimage
else
    echo "执行构建命令: vite build && npx electron-builder --linux --arm64 appImage"
    npx vite build && npx electron-builder --linux --arm64 appImage
fi

# 查找生成的 AppImage 文件
OUTPUT_DIR="release"
if [ "$ARCH" = "x64" ]; then
    OUTPUT_PATTERN="*x86_64*.AppImage"
else
    OUTPUT_PATTERN="*aarch64*.AppImage"
fi

APPIMAGE_FILE=$(find "$OUTPUT_DIR" -name "$OUTPUT_PATTERN" -type f 2>/dev/null | head -1)

if [ -z "$APPIMAGE_FILE" ]; then
    echo "错误: 未找到生成的 AppImage 文件"
    echo "请检查构建日志"
    exit 1
fi

echo "=========================================="
echo "打包完成!"
echo "=========================================="
echo "AppImage 位置: $APPIMAGE_FILE"
echo "文件大小: $(ls -lh "$APPIMAGE_FILE" | awk '{print $5}')"
echo "=========================================="
echo ""
echo "部署说明:"
echo "1. 将 AppImage 文件复制到目标 Linux 系统"
echo "2. 添加执行权限: chmod +x $APPIMAGE_FILE"
echo "3. 直接运行: ./$APPIMAGE_FILE"
echo ""
echo "AppImage 已捆绑所需依赖，可在大多数 Linux 发行版上运行"
echo "=========================================="
