# OpenCorp Linux AppImage 快速开始

## 🚀 一键构建AppImage

### x86_64 (AMD64) 版本

```bash
cd /Users/moqifei/openimsdk/openim-electron-demo
./build-linux-appimage.sh x64
```

### ARM64 版本

```bash
cd /Users/moqifei/openimsdk/openim-electron-demo
./build-linux-appimage.sh arm64
```

## 📦 构建产物

构建完成后，AppImage文件位于：
```
release/Base/<version>/OpenCorp-Base_<version>_<arch>.AppImage
```

## 🚚 部署到目标Linux系统

### 1. 传输文件

```bash
# 从Mac传输到Linux
scp ./release/Base/3.8.4/OpenCorp-Base_3.8.4_x86_64.AppImage user@your-server:/opt/
```

### 2. 在Linux上运行

```bash
# 添加执行权限
chmod +x /opt/OpenCorp-Base_3.8.4_x86_64.AppImage

# 运行应用
/opt/OpenCorp-Base_3.8.4_x86_64.AppImage
```

## ✅ 优势

- ✅ **不依赖系统GLIBC版本**：可以在CentOS 7、Debian 9等旧系统上运行
- ✅ **单文件部署**：只有一个`.AppImage`文件
- ✅ **无需安装**：用户直接运行即可
- ✅ **支持所有主流Linux发行版**

## 📖 详细文档

查看 [APPIIMAGE_BUILD_GUIDE.md](./APPIIMAGE_BUILD_GUIDE.md) 了解更多详细信息。
