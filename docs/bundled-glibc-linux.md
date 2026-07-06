# Linux x64 bundled glibc experiment

## 最新推荐流程：UOS x86_64 信创 deb 包

本文档用于在 UOS/统信桌面专业版 x86_64 环境下打包 Linux deb 信创包。当前方案不会升级和依赖目标机器的系统 glibc，而是在打包阶段编译 glibc 2.34，并把它封进 deb 包内。

适用范围：

- CPU 架构：x86_64 / AMD64
- 系统：UOS/统信桌面专业版 AMD64
- 包格式：deb
- 安装路径：`/opt/OpenCorp-Base`
- 输出文件：`release/Base/3.8.4/OpenCorp-Base_3.8.4_amd64.deb`

### 1. 新打包机准备

建议使用干净的 UOS x86_64 机器作为打包机。不要升级或替换系统自带 glibc。

安装基础编译工具：

```bash
sudo apt update
sudo apt install -y \
  build-essential gawk bison python3 texinfo wget curl xz-utils \
  binutils patchelf cmake make gcc g++ pkg-config
```

安装 Electron/GTK 打包期需要收集的运行库：

```bash
sudo apt install -y \
  libgtk-3-0 libglib2.0-0 libnss3 libnspr4 libx11-6 libx11-xcb1 \
  libxcb1 libxkbcommon0 libasound2 libcups2 libdbus-1-3 \
  libgdk-pixbuf2.0-0 librsvg2-2 shared-mime-info \
  libsystemd0 libkrb5-3 libgssapi-krb5-2 libexpat1 \
  libfontconfig1 libfreetype6
```

如果 UOS 源里某个包名不存在，安装同名或近似的运行库即可。构建期如果还有缺失的 `.so`，脚本会直接报出库名，按库名补齐打包机依赖后重新打包。

### 2. Node/npm 环境

推荐使用 Node.js 16.20.2：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 16.20.2
nvm use 16.20.2
node -v
npm -v
```

如果系统自带 Node 或更高版本 Node 在 UOS 上出现段错误，优先切回 `nvm use 16.20.2`。

### 3. 项目依赖安装

进入项目目录：

```bash
cd ~/Desktop/openim-electron-demo
```

仅打 Electron 包时，使用精简依赖：

```bash
cp package_electron.json package.json
npm install --legacy-peer-deps
```

`--legacy-peer-deps` 用于避开部分 npm peer dependency 冲突。

如果安装 `koffi` 时提示缺 CMake：

```bash
sudo apt install -y cmake
```

如果安装依赖时出现 `spawn ENOMEM`，说明打包机内存不足，可以先降低并发或增加 swap 后重试：

```bash
npm config set jobs 1
npm install --legacy-peer-deps
```

### 4. 信创包打包命令

首次打包前确保 shell 脚本有执行权限：

```bash
chmod +x scripts/*.sh
```

执行信创 x64 包打包：

```bash
npm run build:linux-glibc
```

该命令等价于：

```bash
vite build && USE_BUNDLED_GLIBC=1 electron-builder --linux --x64
```

打包流程会自动执行：

- 编译 glibc 2.34 到 `build/bundled-glibc/x64/install`
- 将 glibc 拷入包内 `resources/glibc`
- 将主程序改为使用包内 glibc loader
- 收集 Electron、koffi、OpenIM SDK 原生库依赖到 `resources/system-libs`
- 收集 GTK 文件选择器需要的 `gdk-pixbuf` loaders、MIME 数据库、GIO modules
- 生成 `/opt/OpenCorp-Base/opencorp-base` 启动脚本
- 安装后在用户桌面创建显示名为 `opencorp-base` 的快捷方式

### 5. 构建结果验证

确认 deb 文件存在：

```bash
ls -lh release/Base/3.8.4/OpenCorp-Base_3.8.4_amd64.deb
```

确认 glibc、系统库、GTK 资源已打入包内：

```bash
dpkg -c release/Base/3.8.4/OpenCorp-Base_3.8.4_amd64.deb | \
  grep -E 'resources/glibc|resources/system-libs|gdk-pixbuf|share/mime|gio/modules|opencorp-base.real'
```

确认安装后脚本存在：

```bash
rm -rf /tmp/opencorp-deb-control
mkdir -p /tmp/opencorp-deb-control
dpkg-deb -e release/Base/3.8.4/OpenCorp-Base_3.8.4_amd64.deb /tmp/opencorp-deb-control
ls /tmp/opencorp-deb-control/postinst /tmp/opencorp-deb-control/postrm
```

安装后还需要确认 `chrome-sandbox` 权限正确：

```bash
stat -c '%U %G %a %n' /opt/OpenCorp-Base/chrome-sandbox
```

期望输出类似：

```bash
root root 4755 /opt/OpenCorp-Base/chrome-sandbox
```

### 6. 目标机器安装验证

生产/测试机器只需要拷贝 deb 文件：

```bash
sudo dpkg -i OpenCorp-Base_3.8.4_amd64.deb
```

手动启动验证：

```bash
/opt/OpenCorp-Base/opencorp-base
```

如果运行时报 `The SUID sandbox helper binary was found, but is not configured correctly`，说明 `/opt/OpenCorp-Base/chrome-sandbox` 权限不正确。重新安装最新版 deb，或临时手动修复：

```bash
sudo chown root:root /opt/OpenCorp-Base/chrome-sandbox
sudo chmod 4755 /opt/OpenCorp-Base/chrome-sandbox
```

需要回归以下功能：

- 登录、聊天、收发消息
- 图片发送、图片下载
- 文件发送、文件下载
- 打开文件选择器和保存对话框时不闪退
- 桌面快捷方式显示为 `opencorp-base`，并可正常启动

### 7. 常见问题

如果构建期提示 `Bundled runtime dependency check failed`，说明还有某个运行库没有被打进包，或者打包机本身缺这个库。按错误中的 `.so` 名称在打包机安装对应包，然后重新执行：

```bash
npm run build:linux-glibc
```

目标机器不需要额外安装这些依赖，只安装 deb 即可。

如果需要重新编译 glibc：

```bash
rm -rf build/bundled-glibc/x64
npm run build:linux-glibc
```
