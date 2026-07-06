# OpenCorp Linux AppImage 打包说明

## 什么是AppImage？

AppImage是一种免安装的Linux应用程序格式，它将应用程序及其所有依赖（包括libc）打包成一个单独的文件。用户只需下载并运行即可，无需安装。

## 优势

- ✅ **不依赖系统GLIBC版本**：AppImage捆绑了自己的libc，可以在任何Linux发行版上运行
- ✅ **单文件部署**：只有一个`.AppImage`文件，易于分发
- ✅ **无需root权限**：用户可以直接运行，不需要管理员权限
- ✅ **桌面集成**：支持双击运行、添加到应用程序菜单

## 构建AppImage

### 方式1：使用构建脚本（推荐）

```bash
# 构建 x86_64 (AMD64) 版本
./build-linux-appimage.sh x64

# 构建 ARM64 版本
./build-linux-appimage.sh arm64
```

### 方式2：使用npm脚本

```bash
# 构建 x86_64 版本
npm run build:linux-appimage

# 构建 ARM64 版本
npm run build:linux-appimage-arm
```

### 方式3：使用electron-builder直接构建

```bash
# 构建 x86_64 AppImage
npx electron-builder --linux --x64 AppImage

# 构建 ARM64 AppImage
npx electron-builder --linux --arm64 AppImage
```

## 构建产物

构建完成后，AppImage文件位于：
```
release/Base/<version>/OpenCorp-Base_<version>_<arch>.AppImage
```

例如：
```
release/Base/3.8.4/OpenCorp-Base_3.8.4_x86_64.AppImage
release/Base/3.8.4/OpenCorp-Base_3.8.4_aarch64.AppImage
```

## 部署到目标系统

### 1. 复制AppImage文件到目标Linux系统

```bash
# 从Mac拷贝到Linux
scp ./release/Base/3.8.4/OpenCorp-Base_3.8.4_x86_64.AppImage user@linux-server:/opt/
```

### 2. 添加执行权限

```bash
chmod +x /opt/OpenCorp-Base_3.8.4_x86_64.AppImage
```

### 3. 运行应用

```bash
# 直接运行
/opt/OpenCorp-Base_3.8.4_x86_64.AppImage

# 或者双击（如果桌面环境支持）
```

## 支持的Linux发行版

由于AppImage捆绑了自身依赖，它可以在以下发行版上运行（无需考虑GLIBC版本）：

- ✅ CentOS 7 / RHEL 7 (GLIBC 2.17)
- ✅ Debian 9+ (GLIBC 2.24+)
- ✅ Ubuntu 16.04+ (GLIBC 2.23+)
- ✅ Fedora 25+ (GLIBC 2.26+)
- ✅ openSUSE 13+ (GLIBC 2.19+)
- ✅ Arch Linux
- ✅ 以及其他大多数现代Linux发行版

## 注意事项

### 1. 桌面集成（可选）

首次运行时，AppImage可能会提示是否集成到桌面环境。您可以选择：
- 添加到应用程序菜单
- 创建桌面快捷方式

### 2. 依赖的系统库

虽然AppImage捆绑了libc，但仍需要一些基本的系统支持：
- FUSE（文件系统用户空间）：大多数现代Linux发行版已默认支持
- GUI库：GTK3、Qt5等（AppImage已捆绑）

### 3. 签名和验证（可选）

为了提高安全性，您可以对AppImage进行签名：

```bash
# 安装signify
sudo apt install signify-openbsd  # Debian/Ubuntu
sudo yum install signify          # CentOS/RHEL

# 签名AppImage
signify -S -s secret.key -t "" -o OpenCorp-Base_3.8.4_x86_64.AppImage.sig -m OpenCorp-Base_3.8.4_x86_64.AppImage

# 验证签名
signify -C -p public.key -m OpenCorp-Base_3.8.4_x86_64.AppImage -s OpenCorp-Base_3.8.4_x86_64.AppImage.sig
```

### 4. 自动更新

AppImage支持AppImageUpdate进行自动更新。在应用中集成更新逻辑，用户可以下载新的AppImage文件并替换旧文件。

## 常见问题

### Q1: 为什么不用deb包？

A: deb包依赖系统的GLIBC版本。如果目标系统的GLIBC版本低于2.33，预编译的`libopenimsdk.so`无法运行。AppImage捆绑了所有依赖，解决了这个问题。

### Q2: AppImage文件很大怎么办？

A: AppImage包含所有依赖，通常在100MB-500MB之间。这是正常现象。可以使用AppImageHub或CDN进行分发。

### Q3: 如何在无桌面环境的服务器上运行？

A: AppImage需要GUI环境。如果是无头服务器，需要使用X11转发或VNC。

### Q4: ARM64架构的AppImage能在树莓派上运行吗？

A: 可以！ARM64 AppImage支持：
- 树莓派4（64位系统）
- AWS Graviton实例
- 其他ARM64服务器

### Q5: 如何自定义AppImage图标？

A: 在`electron-builder.json5`的`linux`配置中设置`icon`字段：

```json
{
  "linux": {
    "icon": "./dist/icons/icon.png",
    ...
  }
}
```

## 技术细节

### AppImage包含的内容

1. **Electron框架**：Chromium + Node.js
2. **应用代码**：dist/ 和 dist-electron/
3. **Node模块**：node_modules/（除rxjs、koffi等已排除的）
4. **原生库**：
   - `libopenimsdk.so`（来自`@openim/electron-client-sdk`）
   - `koffi`原生模块
5. **AppImage运行时**：处理FUSE和桌面集成

### GLIBC兼容性

传统deb包中的`libopenimsdk.so`需要GLIBC 2.33+，但AppImage通过以下方式解决：
- 使用更新的glibc编译Electron运行时
- 或者在AppImage中捆绑自定义的glibc

## 参考资料

- [AppImage官方文档](https://appimage.org/)
- [electron-builder AppImage配置](https://www.electron.build/linux.html#common-extra-configuration)
- [AppImageHub](https://appimage.github.io/) - AppImage应用市场

## 联系支持

如有问题，请联系OpenIM团队或查看项目文档。
