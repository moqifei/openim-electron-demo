#!/bin/bash

# OpenCorp Linux Deb Packager Script
# 使用 dpkg-deb 替代 electron-builder 内置的 fpm 工具
# 支持架构: arm64, amd64

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 默认架构为 arm64，可以通过参数指定
ARCH=${1:-arm64}

# 验证架构参数
if [[ "$ARCH" != "arm64" && "$ARCH" != "amd64" ]]; then
    echo "错误: 不支持的架构 '$ARCH'"
    echo "用法: $0 [arm64|amd64]"
    echo "示例: $0 arm64  # 打包 ARM64 版本"
    echo "      $0 amd64   # 打包 AMD64/x86_64 版本"
    exit 1
fi

echo "=========================================="
echo "OpenCorp Linux $ARCH Deb Packager"
echo "=========================================="

# 检查必要的工具
command -v dpkg-deb >/dev/null 2>&1 || { 
    echo "错误: 需要安装 dpkg-deb，请运行: brew install dpkg"
    exit 1
}

# 清理之前的构建
echo "清理之前的构建..."
rm -rf release dist dist-electron

# 构建前端和 Electron
echo "构建前端和 Electron (架构: $ARCH)..."
npm run build:linux-arm 2>/dev/null || npm run build:linux

# 获取版本号
VERSION=$(node -p "require('./package.json').version")
PRODUCT_NAME="OpenCorp-Base"

# 根据架构设置对应的构建命令和目录名
if [ "$ARCH" = "arm64" ]; then
    BUILD_CMD="build:linux-arm"
    UNPACKED_SUFFIX="linux-arm64-unpacked"
    DEB_ARCH="arm64"
else
    BUILD_CMD="build:linux"
    UNPACKED_SUFFIX="linux-unpacked"
    DEB_ARCH="amd64"
fi

echo "执行构建命令: npm run $BUILD_CMD"
npm run $BUILD_CMD

# 设置路径
OUTPUT_DIR="release/Base/${VERSION}"
UNPACKED_DIR="${OUTPUT_DIR}/${UNPACKED_SUFFIX}"
DEB_CONTROL_DIR="${OUTPUT_DIR}/deb-control-${ARCH}"
FINAL_DEB="${OUTPUT_DIR}/${PRODUCT_NAME}_${VERSION}_${DEB_ARCH}.deb"

echo "创建 deb 控制文件..."
mkdir -p "${DEB_CONTROL_DIR}/DEBIAN"

# 创建 control 文件
cat > "${DEB_CONTROL_DIR}/DEBIAN/control" << EOF
Package: opencorp-base
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${DEB_ARCH}
Maintainer: opencorp-base <opencorp@example.com>
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Description: OpenIM PC Client.
 Desktop client for OpenIM messaging platform.
EOF

echo "复制应用文件到 deb 控制目录..."
if [ -d "${UNPACKED_DIR}" ]; then
    cp -R "${UNPACKED_DIR}/"* "${DEB_CONTROL_DIR}/"
else
    echo "错误: 未找到 unpacked 目录: ${UNPACKED_DIR}"
    exit 1
fi

echo "创建 deb 包..."
dpkg-deb --build --root-owner-group "${DEB_CONTROL_DIR}" "${FINAL_DEB}"

echo "=========================================="
echo "打包完成!"
echo "=========================================="
echo "Deb 包位置: ${FINAL_DEB}"
echo "文件大小: $(ls -lh "${FINAL_DEB}" | awk '{print $5}')"
echo "=========================================="

# 显示 deb 包信息
echo ""
echo "Deb 包信息:"
dpkg-deb --info "${FINAL_DEB}"
