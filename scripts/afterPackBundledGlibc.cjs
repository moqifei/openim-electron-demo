const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_EXECUTABLE_NAME = "年糕";
const DEFAULT_GLIBC_SOURCE_DIR = path.join(
  "build",
  "bundled-glibc",
  "x64",
  "install",
);
const DEFAULT_LINUX_INSTALL_DIR = "/opt/StickyCake";
const SYSTEM_LIBS_DIR_NAME = "system-libs";
const GDK_PIXBUF_RESOURCE_DIR_NAME = "gdk-pixbuf-2.0";
const GDK_PIXBUF_VERSION_DIR_NAME = "2.10.0";
const SHARE_RESOURCE_DIR_NAME = "share";
const GIO_MODULE_RESOURCE_DIR_NAME = path.join("gio", "modules");
const GTK_IM_RESOURCE_DIR_NAME = path.join("gtk-3.0", "3.0.0");
const GTK_FCITX_MODULE_NAME = "im-fcitx.so";
const FCITX_GCLIENT_LIBRARY_NAME = "libfcitx-gclient.so.1";
const FCITX_UTILS_LIBRARY_NAME = "libfcitx-utils.so.0";
const FCITX_CORE_LIBRARY_NAMES = [
  "libfcitx-config.so.4",
  "libfcitx-core.so.0",
  FCITX_GCLIENT_LIBRARY_NAME,
  FCITX_UTILS_LIBRARY_NAME,
];
const FCITX_LIBRARY_DIRECTORIES = [
  "/usr/lib/x86_64-linux-gnu/fcitx",
  "/usr/lib/x86_64-linux-gnu/fcitx-4.0",
  "/usr/lib64/fcitx",
  "/usr/lib64/fcitx-4.0",
  "/usr/lib/fcitx",
  "/usr/lib/fcitx-4.0",
  "/lib/x86_64-linux-gnu/fcitx",
  "/lib/x86_64-linux-gnu/fcitx-4.0",
  "/lib64/fcitx",
  "/lib64/fcitx-4.0",
  "/lib/fcitx",
  "/lib/fcitx-4.0",
];
const GLIBC_CORE_BASENAMES = new Set([
  "ld-linux-x86-64.so.2",
  "libc.so.6",
  "libm.so.6",
  "libpthread.so.0",
  "librt.so.1",
  "libdl.so.2",
  "libutil.so.1",
  "libanl.so.1",
  "libresolv.so.2",
  "libnss_compat.so.2",
  "libnss_compat.so",
  "libnss_dns.so.2",
  "libnss_dns.so",
  "libnss_files.so.2",
  "libnss_files.so",
  "libnss_hesiod.so.2",
  "libnss_hesiod.so",
  "libnss_nis.so.2",
  "libnss_nis.so",
  "libnss_nisplus.so.2",
  "libnss_nisplus.so",
  "libnss_db.so.2",
  "libnss_db.so",
  "libnss_systemd.so.2",
  "libnss_systemd.so",
  "libnss_mdns4_minimal.so.2",
  "libnss_mdns4_minimal.so",
  "libnss_mdns6_minimal.so.2",
  "libnss_mdns6_minimal.so",
  "libnss_mdns4.so.2",
  "libnss_mdns4.so",
  "libnss_mdns6.so.2",
  "libnss_mdns6.so",
  "libcrypt.so.1",
  "libcrypt-2.0.so.0",
  "libBrokenLocale.so.1",
  "libthread_db.so.1",
  "libmemusage.so",
  "libpcprofile.so",
  "libcidn.so.1",
  "libnsl.so.1",
]);
const ADDITIONAL_SYSTEM_LIBRARY_BASENAMES = [
  "libgobject-2.0.so.0",
  "libglib-2.0.so.0",
  "libgio-2.0.so.0",
  "libgmodule-2.0.so.0",
  "libgthread-2.0.so.0",
  "libgtk-3.so.0",
  "libgdk-3.so.0",
  "libgdk_pixbuf-2.0.so.0",
  "libatk-1.0.so.0",
  "libatk-bridge-2.0.so.0",
  "libatspi.so.0",
  "libpango-1.0.so.0",
  "libpangocairo-1.0.so.0",
  "libpangoft2-1.0.so.0",
  "libharfbuzz.so.0",
  "libcairo.so.2",
  "libcairo-gobject.so.2",
  "libfontconfig.so.1",
  "libfreetype.so.6",
  "libX11.so.6",
  "libX11-xcb.so.1",
  "libxcb.so.1",
  "libxcb-dri3.so.0",
  "libxcb-shm.so.0",
  "libxcb-render.so.0",
  "libxcb-shape.so.0",
  "libxcb-xfixes.so.0",
  "libXcomposite.so.1",
  "libXcursor.so.1",
  "libXdamage.so.1",
  "libXext.so.6",
  "libXfixes.so.3",
  "libXi.so.6",
  "libXinerama.so.1",
  "libXrandr.so.2",
  "libXrender.so.1",
  "libXtst.so.6",
  "libxkbcommon.so.0",
  "libxshmfence.so.1",
  "libdbus-1.so.3",
  "libcups.so.2",
  "libasound.so.2",
  "libnss3.so",
  "libnssutil3.so",
  "libsoftokn3.so",
  "libfreebl3.so",
  "libfreeblpriv3.so",
  "libnssdbm3.so",
  "libnssckbi.so",
  "libsqlite3.so.0",
  "libsmime3.so",
  "libssl3.so",
  "libnspr4.so",
  "libplc4.so",
  "libplds4.so",
  "libdrm.so.2",
  "libgbm.so.1",
  "libwayland-client.so.0",
  "libwayland-cursor.so.0",
  "libwayland-egl.so.1",
  "libsecret-1.so.0",
  "libnotify.so.4",
  "libexpat.so.1",
  "libxml2.so.2",
  "libz.so.1",
  "libpng16.so.16",
  "libjpeg.so.62",
  "libjpeg.so.8",
  "libwebp.so.6",
  "libwebp.so.7",
  "libwebpdemux.so.2",
  "libwebpmux.so.3",
  "libtiff.so.5",
  "libtiff.so.6",
  "libjbig.so.0",
  "libopenjp2.so.7",
  "libLerc.so.4",
  "libffi.so.6",
  "libffi.so.7",
  "libffi.so.8",
  "libpcre.so.3",
  "libpcre2-8.so.0",
  "libmount.so.1",
  "libblkid.so.1",
  "libuuid.so.1",
  "libselinux.so.1",
  "libbsd.so.0",
  "libmd.so.0",
  "libgraphite2.so.3",
  "libpixman-1.so.0",
  "libXau.so.6",
  "libXdmcp.so.6",
  "libXss.so.1",
  "libICE.so.6",
  "libSM.so.6",
  "liblzma.so.5",
  "libbz2.so.1.0",
  "libbrotlidec.so.1",
  "libbrotlicommon.so.1",
  "libthai.so.0",
  "libdatrie.so.1",
  "librsvg-2.so.2",
  "libcroco-0.6.so.3",
  "libicui18n.so.63",
  "libicuuc.so.63",
  "libicudata.so.63",
  "libicuio.so.63",
  "libgssapi_krb5.so.2",
  "libkrb5.so.3",
  "libk5crypto.so.3",
  "libkrb5support.so.0",
  "libcom_err.so.2",
  "libkeyutils.so.1",
  "libldap-2.4.so.2",
  "libldap-2.5.so.0",
  "libldap-2.6.so.0",
  "liblber-2.4.so.2",
  "liblber-2.5.so.0",
  "liblber-2.6.so.0",
  "libsasl2.so.2",
  "libgnutls.so.30",
  "libnettle.so.6",
  "libnettle.so.8",
  "libhogweed.so.4",
  "libhogweed.so.6",
  "libgmp.so.10",
  "libp11-kit.so.0",
  "libtasn1.so.6",
  "libunistring.so.0",
  "libunistring.so.2",
  "libidn2.so.0",
  "libavahi-client.so.3",
  "libavahi-common.so.3",
  "libsystemd.so.0",
  "libudev.so.1",
  "libcap.so.2",
  "liblz4.so.1",
  "libzstd.so.1",
  "libgcrypt.so.20",
  "libgpg-error.so.0",
  "libapparmor.so.1",
  "libaudit.so.1",
  "libacl.so.1",
  "libattr.so.1",
  "libseccomp.so.2",
  "libstdc++.so.6",
  "libgcc_s.so.1",
];
const ADDITIONAL_SYSTEM_LIBRARY_PATTERNS = [
  /^libicu[a-z0-9]*\.so\.\d+(?:\.\d+)*$/,
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function findExecutable(appOutDir, appInfo) {
  const names = unique([
    appInfo && appInfo.executableName,
    appInfo && appInfo.productFilename,
    appInfo && appInfo.productName,
    appInfo && appInfo.name,
    DEFAULT_EXECUTABLE_NAME,
  ]);
  const candidates = unique(names.flatMap((name) => [name, String(name).toLowerCase()]));

  for (const name of candidates) {
    const candidate = path.join(appOutDir, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  throw new Error(
    `Cannot find Linux executable in ${appOutDir}. Tried: ${candidates.join(", ")}`,
  );
}

function ensureGlibcSource(projectDir) {
  const sourceDir = path.resolve(
    projectDir,
    process.env.BUNDLED_GLIBC_DIR || DEFAULT_GLIBC_SOURCE_DIR,
  );
  const loaderCandidates = [
    path.join(sourceDir, "lib", "ld-linux-x86-64.so.2"),
    path.join(sourceDir, "lib64", "ld-linux-x86-64.so.2"),
  ];

  if (!loaderCandidates.some((candidate) => fs.existsSync(candidate))) {
    throw new Error(
      [
        "Bundled glibc is enabled, but no loader was found.",
        `Expected one of: ${loaderCandidates.join(", ")}`,
        "Run npm run prepare:glibc:x64 before packaging, or use npm run build:linux-glibc.",
      ].join(" "),
    );
  }

  return sourceDir;
}

function getGlibcLoaderDirName(glibcDir) {
  const candidates = ["lib", "lib64"];

  for (const dirName of candidates) {
    const loaderPath = path.join(glibcDir, dirName, "ld-linux-x86-64.so.2");
    if (fs.existsSync(loaderPath)) {
      return dirName;
    }
  }

  throw new Error(`Cannot find bundled glibc loader in ${glibcDir}`);
}

function ensureLibraryAlias(libDir, versionedName, aliasName) {
  const versionedPath = path.join(libDir, versionedName);
  const aliasPath = path.join(libDir, aliasName);

  if (!fs.existsSync(versionedPath) || fs.existsSync(aliasPath)) {
    return;
  }

  try {
    fs.symlinkSync(versionedName, aliasPath);
  } catch {
    fs.copyFileSync(versionedPath, aliasPath);
  }
}

function ensureGlibcRuntimeAliases(glibcDir) {
  const aliases = [
    ["libnss_compat.so.2", "libnss_compat.so"],
    ["libnss_db.so.2", "libnss_db.so"],
    ["libnss_dns.so.2", "libnss_dns.so"],
    ["libnss_files.so.2", "libnss_files.so"],
    ["libnss_hesiod.so.2", "libnss_hesiod.so"],
    ["libnss_nis.so.2", "libnss_nis.so"],
    ["libnss_nisplus.so.2", "libnss_nisplus.so"],
  ];

  for (const dirName of ["lib", "lib64"]) {
    const libDir = path.join(glibcDir, dirName);
    if (!fs.existsSync(libDir)) {
      continue;
    }

    for (const [versionedName, aliasName] of aliases) {
      ensureLibraryAlias(libDir, versionedName, aliasName);
    }
  }
}

function getLinuxInstallDir(appInfo) {
  if (process.env.BUNDLED_GLIBC_LINUX_INSTALL_DIR) {
    return process.env.BUNDLED_GLIBC_LINUX_INSTALL_DIR;
  }

  return DEFAULT_LINUX_INSTALL_DIR;
}

function walkFiles(rootDir, predicate, collected = []) {
  if (!fs.existsSync(rootDir)) {
    return collected;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, predicate, collected);
      continue;
    }
    if (!predicate || predicate(entryPath)) {
      collected.push(entryPath);
    }
  }

  return collected;
}

function getLibrarySearchPaths(context, sourceDir, systemLibsDir) {
  const paths = unique([
    path.join(sourceDir, "lib"),
    path.join(sourceDir, "lib64"),
    systemLibsDir,
    path.join(context.appOutDir, "resources", "glibc", "lib"),
    path.join(context.appOutDir, "resources", "glibc", "lib64"),
    path.join(context.appOutDir, "resources", "koffi", "linux_x64"),
    path.join(
      context.appOutDir,
      "resources",
      "app.asar.unpacked",
      "node_modules",
      "@openim",
      "electron-client-sdk",
      "assets",
      "linux_x64",
    ),
    ...FCITX_LIBRARY_DIRECTORIES,
    "/lib/x86_64-linux-gnu/nss",
    "/usr/lib/x86_64-linux-gnu/nss",
    "/lib64/nss",
    "/usr/lib64/nss",
    "/lib/nss",
    "/usr/lib/nss",
    "/lib/x86_64-linux-gnu",
    "/usr/lib/x86_64-linux-gnu",
    "/lib64",
    "/usr/lib64",
    "/lib",
    "/usr/lib",
  ]);

  return paths.filter((dir) => fs.existsSync(dir));
}

function normalizeExistingPath(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return filePath;
  }

  try {
    return fs.realpathSync(filePath);
  } catch {
    return filePath;
  }
}

function parseBinaryDependencies(binaryPath) {
  const result = spawnSync("readelf", ["-d", binaryPath], {
    encoding: "utf8",
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        "readelf is not available. Install binutils before building the bundled glibc package.",
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Failed to inspect binary dependencies for ${binaryPath}`,
        result.stderr || result.stdout || `exit code ${result.status}`,
      ].join(": "),
    );
  }

  const dependencies = [];
  for (const rawLine of (result.stdout || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const match = line.match(/\(NEEDED\)\s+Shared library: \[(.+?)\]/);
    if (match) {
      dependencies.push(match[1]);
    }
  }

  return dependencies;
}

function shouldSkipDependency(libraryName) {
  if (!libraryName) {
    return true;
  }
  if (libraryName.startsWith("ld-linux")) {
    return true;
  }
  return GLIBC_CORE_BASENAMES.has(libraryName);
}

function resolveLibraryPathByName(libraryName, searchPaths) {
  for (const searchPath of searchPaths) {
    const candidate = path.join(searchPath, libraryName);
    if (fs.existsSync(candidate)) {
      return normalizeExistingPath(candidate);
    }
  }

  const versionedNameMatch = libraryName.match(/^(.*\.so\.\d+(?:\.\d+)*)$/);
  if (!versionedNameMatch) {
    return null;
  }

  const versionedNamePattern = new RegExp(
    `^${versionedNameMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.\\d+)*$`,
  );
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) {
      continue;
    }

    const fallback = fs
      .readdirSync(searchPath, { withFileTypes: true })
      .filter(
        (entry) =>
          (entry.isFile() || entry.isSymbolicLink()) && versionedNamePattern.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort((left, right) => left.length - right.length)[0];

    if (fallback) {
      return normalizeExistingPath(path.join(searchPath, fallback));
    }
  }

  return null;
}

function copyResolvedLibrary(libraryName, resolvedPath, systemLibsDir, copiedNames) {
  const destinationName = path.basename(libraryName);
  const destination = path.join(systemLibsDir, destinationName);

  if (!copiedNames.has(destinationName)) {
    fs.copyFileSync(resolvedPath, destination);
    copiedNames.add(destinationName);
  }

  return destination;
}

function copyLibraryClosure(libraryNames, searchPaths, systemLibsDir, copiedNames) {
  const queue = [];
  const visited = new Set();
  const missing = new Set();
  let copiedCount = 0;

  const enqueueLibrary = (libraryName) => {
    if (shouldSkipDependency(libraryName)) {
      return;
    }

    const resolvedPath = resolveLibraryPathByName(libraryName, searchPaths);
    if (!resolvedPath) {
      missing.add(libraryName);
      return;
    }

    const beforeCopyCount = copiedNames.size;
    copyResolvedLibrary(libraryName, resolvedPath, systemLibsDir, copiedNames);
    if (copiedNames.size > beforeCopyCount) {
      copiedCount += 1;
    }
    queue.push(resolvedPath);
  };

  for (const libraryName of unique(libraryNames)) {
    enqueueLibrary(libraryName);
  }

  while (queue.length > 0) {
    const current = normalizeExistingPath(queue.shift());
    if (!current || visited.has(current) || !fs.existsSync(current)) {
      continue;
    }
    visited.add(current);

    for (const dependencyName of parseBinaryDependencies(current)) {
      enqueueLibrary(dependencyName);
    }
  }

  return { copiedCount, missing };
}

function collectMatchingSystemLibraries(patterns, searchPaths, systemLibsDir, copiedNames) {
  const matchedLibraryNames = [];

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) {
      continue;
    }

    for (const entry of fs.readdirSync(searchPath, { withFileTypes: true })) {
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        continue;
      }
      if (patterns.some((pattern) => pattern.test(entry.name))) {
        matchedLibraryNames.push(entry.name);
      }
    }
  }

  if (matchedLibraryNames.length === 0) {
    return { copiedCount: 0, missing: new Set() };
  }

  return copyLibraryClosure(matchedLibraryNames, searchPaths, systemLibsDir, copiedNames);
}

function findFirstDirectory(candidates, requiredChild) {
  return (
    candidates.find((candidate) => {
      if (!candidate || !fs.existsSync(candidate)) {
        return false;
      }
      return requiredChild ? fs.existsSync(path.join(candidate, requiredChild)) : true;
    }) || null
  );
}

function findFcitxGtkSourceDir() {
  return findFirstDirectory([
    path.join("/usr", "lib", "x86_64-linux-gnu", "gtk-3.0", "3.0.0"),
    path.join("/usr", "lib64", "gtk-3.0", "3.0.0"),
    path.join("/usr", "lib", "gtk-3.0", "3.0.0"),
    path.join("/lib", "x86_64-linux-gnu", "gtk-3.0", "3.0.0"),
    path.join("/lib64", "gtk-3.0", "3.0.0"),
    path.join("/lib", "gtk-3.0", "3.0.0"),
  ], path.join("immodules", GTK_FCITX_MODULE_NAME));
}

function rewriteGtkImmodulesCache(cacheContent, installedModulePath) {
  return cacheContent.replace(
    /"[^"\r\n]*\/immodules\/im-fcitx\.so"/g,
    `"${installedModulePath}"`,
  );
}

function patchFcitxRuntimePaths(targetModulePath, systemLibsDir) {
  runPatchelf(
    [
      "--force-rpath",
      "--set-rpath",
      [
        "$ORIGIN/../../../system-libs",
        "$ORIGIN/../../../glibc/lib",
        "$ORIGIN/../../../glibc/lib64",
      ].join(":"),
      targetModulePath,
    ],
    `set runtime library path on ${targetModulePath}`,
  );

  const fcitxLibraryPaths = fs
    .readdirSync(systemLibsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        (entry.isFile() || entry.isSymbolicLink()) &&
        /^libfcitx[^/]*\.so(?:\..*)?$/.test(entry.name),
    )
    .map((entry) => path.join(systemLibsDir, entry.name));

  for (const libraryPath of fcitxLibraryPaths) {
    runPatchelf(
      [
        "--force-rpath",
        "--set-rpath",
        ["$ORIGIN", "$ORIGIN/../glibc/lib", "$ORIGIN/../glibc/lib64"].join(":"),
        libraryPath,
      ],
      `set runtime library path on ${libraryPath}`,
    );
  }
}

function collectFcitxGtkResources(context, installDir, dependencyContext) {
  const sourceDir = findFcitxGtkSourceDir();
  if (!sourceDir) {
    throw new Error(
      `[bundled-glibc] GTK Fcitx module was not found on build machine; install Fcitx 4 GTK3 support and ensure ${GTK_FCITX_MODULE_NAME} exists.`,
    );
  }

  const sourceModulePath = path.join(sourceDir, "immodules", GTK_FCITX_MODULE_NAME);
  const targetDir = path.join(context.appOutDir, "resources", GTK_IM_RESOURCE_DIR_NAME);
  const targetModuleDir = path.join(targetDir, "immodules");
  const targetModulePath = path.join(targetModuleDir, GTK_FCITX_MODULE_NAME);
  const installedModulePath = path.posix.join(
    installDir,
    "resources",
    GTK_IM_RESOURCE_DIR_NAME.replace(/\\/g, "/"),
    "immodules",
    GTK_FCITX_MODULE_NAME,
  );

  fs.mkdirSync(targetModuleDir, { recursive: true });
  fs.copyFileSync(sourceModulePath, targetModulePath);

  const sourceCachePath = path.join(sourceDir, "immodules.cache");
  const targetCachePath = path.join(targetDir, "immodules.cache");
  if (fs.existsSync(sourceCachePath)) {
    const cacheContent = fs.readFileSync(sourceCachePath, "utf8");
    fs.writeFileSync(
      targetCachePath,
      rewriteGtkImmodulesCache(cacheContent, installedModulePath),
    );
  } else {
    console.warn(`[bundled-glibc] GTK input method cache was not found: ${sourceCachePath}`);
  }

  const pluginSearchPaths = unique([
    path.join(sourceDir, "immodules"),
    sourceDir,
    ...dependencyContext.searchPaths,
  ]);
  const result = copyLibraryClosure(
    [
      ...FCITX_CORE_LIBRARY_NAMES,
      ...parseBinaryDependencies(sourceModulePath),
    ],
    pluginSearchPaths,
    dependencyContext.systemLibsDir,
    dependencyContext.copiedNames,
  );
  if (result.missing.size > 0) {
    throw new Error(
      `[bundled-glibc] Missing GTK Fcitx libraries: ${[...result.missing].sort().join(", ")}`,
    );
  }

  patchFcitxRuntimePaths(targetModulePath, dependencyContext.systemLibsDir);

  console.log(
    `[bundled-glibc] Copied GTK Fcitx module and ${FCITX_GCLIENT_LIBRARY_NAME} dependencies`,
  );
}

function collectPluginDependencies(label, pluginFiles, pluginSearchPaths, dependencyContext) {
  for (const pluginPath of pluginFiles) {
    const dependencies = parseBinaryDependencies(pluginPath);
    const result = copyLibraryClosure(
      dependencies,
      pluginSearchPaths,
      dependencyContext.systemLibsDir,
      dependencyContext.copiedNames,
    );
    if (result.missing.size > 0) {
      console.warn(
        `[bundled-glibc] Missing dependencies for ${label} ${pluginPath}: ${[...result.missing]
          .sort()
          .join(", ")}`,
      );
    }
  }
}

function validatePluginDependencies(
  label,
  context,
  pluginFiles,
  pluginSearchPaths,
  pluginRuntimePath,
  dependencyContext,
) {
  const bundledGlibcDir = path.join(context.appOutDir, "resources", "glibc");
  const bundledLoaderPath = path.join(
    bundledGlibcDir,
    getGlibcLoaderDirName(bundledGlibcDir),
    "ld-linux-x86-64.so.2",
  );
  const baseLibraryPath = getPackagedLibraryPath(
    context.appOutDir,
    bundledGlibcDir,
    dependencyContext.systemLibsDir,
  );
  const pluginLibraryPath = `${baseLibraryPath}:${pluginRuntimePath}`;

  for (const pluginPath of pluginFiles) {
    let lastPluginCheck = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      lastPluginCheck = runRuntimeDependencyCheck(
        bundledLoaderPath,
        pluginLibraryPath,
        pluginPath,
      );
      if (lastPluginCheck.ok) {
        break;
      }

      const missingLibraries = extractMissingLibraries(lastPluginCheck.output);
      if (missingLibraries.length === 0) {
        break;
      }

      const repaired = copyLibraryClosure(
        missingLibraries,
        pluginSearchPaths,
        dependencyContext.systemLibsDir,
        dependencyContext.copiedNames,
      );
      if (repaired.copiedCount === 0) {
        break;
      }

      console.warn(
        `[bundled-glibc] Added ${repaired.copiedCount} missing ${label} libraries after check: ${missingLibraries.join(", ")}`,
      );
    }

    if (lastPluginCheck && !lastPluginCheck.ok) {
      console.warn(
        `[bundled-glibc] ${label} dependency check warning for ${pluginPath}:\n${lastPluginCheck.output}`,
      );
    }
  }
}

function findGdkPixbufSourceDir() {
  const candidates = [
    path.join(
      "/usr",
      "lib",
      "x86_64-linux-gnu",
      GDK_PIXBUF_RESOURCE_DIR_NAME,
      GDK_PIXBUF_VERSION_DIR_NAME,
    ),
    path.join("/usr", "lib64", GDK_PIXBUF_RESOURCE_DIR_NAME, GDK_PIXBUF_VERSION_DIR_NAME),
    path.join("/usr", "lib", GDK_PIXBUF_RESOURCE_DIR_NAME, GDK_PIXBUF_VERSION_DIR_NAME),
    path.join(
      "/lib",
      "x86_64-linux-gnu",
      GDK_PIXBUF_RESOURCE_DIR_NAME,
      GDK_PIXBUF_VERSION_DIR_NAME,
    ),
    path.join("/lib64", GDK_PIXBUF_RESOURCE_DIR_NAME, GDK_PIXBUF_VERSION_DIR_NAME),
    path.join("/lib", GDK_PIXBUF_RESOURCE_DIR_NAME, GDK_PIXBUF_VERSION_DIR_NAME),
  ];

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "loaders"))) || null;
}

function rewriteGdkPixbufCache(cacheContent, installedLoadersDir) {
  return cacheContent.replace(
    /"[^"\r\n]*\/gdk-pixbuf-2\.0\/2\.10\.0\/loaders\/([^"]+)"/g,
    (_, loaderName) => `"${installedLoadersDir}/${loaderName}"`,
  );
}

function collectGdkPixbufLoaders(context, installDir, dependencyContext) {
  const sourceDir = findGdkPixbufSourceDir();
  if (!sourceDir) {
    console.warn("[bundled-glibc] gdk-pixbuf loader directory was not found on build machine.");
    return;
  }

  const sourceLoadersDir = path.join(sourceDir, "loaders");
  const targetDir = path.join(
    context.appOutDir,
    "resources",
    GDK_PIXBUF_RESOURCE_DIR_NAME,
    GDK_PIXBUF_VERSION_DIR_NAME,
  );
  const targetLoadersDir = path.join(targetDir, "loaders");
  const installedLoadersDir = path.posix.join(
    installDir,
    "resources",
    GDK_PIXBUF_RESOURCE_DIR_NAME,
    GDK_PIXBUF_VERSION_DIR_NAME,
    "loaders",
  );

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceLoadersDir, targetLoadersDir, { recursive: true });

  const sourceCachePath = path.join(sourceDir, "loaders.cache");
  const targetCachePath = path.join(targetDir, "loaders.cache");
  if (fs.existsSync(sourceCachePath)) {
    const rewrittenCache = rewriteGdkPixbufCache(
      fs.readFileSync(sourceCachePath, "utf8"),
      installedLoadersDir,
    );
    fs.writeFileSync(targetCachePath, rewrittenCache);
  } else {
    console.warn(`[bundled-glibc] gdk-pixbuf loaders.cache was not found: ${sourceCachePath}`);
  }

  const loaderFiles = walkFiles(
    targetLoadersDir,
    (filePath) => filePath.endsWith(".so") || filePath.includes(".so."),
  );
  const pluginSearchPaths = unique([
    targetLoadersDir,
    sourceLoadersDir,
    ...dependencyContext.searchPaths,
  ]);

  for (const loaderPath of loaderFiles) {
    const dependencies = parseBinaryDependencies(loaderPath);
    const result = copyLibraryClosure(
      dependencies,
      pluginSearchPaths,
      dependencyContext.systemLibsDir,
      dependencyContext.copiedNames,
    );
    if (result.missing.size > 0) {
      console.warn(
        `[bundled-glibc] Missing dependencies for ${loaderPath}: ${[...result.missing]
          .sort()
          .join(", ")}`,
      );
    }
  }

  const loaderLibraryPath = getPackagedLibraryPath(
    context.appOutDir,
    path.join(context.appOutDir, "resources", "glibc"),
    dependencyContext.systemLibsDir,
  );
  const bundledGlibcDir = path.join(context.appOutDir, "resources", "glibc");
  const bundledLoaderPath = path.join(
    bundledGlibcDir,
    getGlibcLoaderDirName(bundledGlibcDir),
    "ld-linux-x86-64.so.2",
  );
  const loaderLibraryPathWithPlugins = `${loaderLibraryPath}:${targetLoadersDir}`;
  for (const loaderPath of loaderFiles) {
    let lastLoaderCheck = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      lastLoaderCheck = runRuntimeDependencyCheck(
        bundledLoaderPath,
        loaderLibraryPathWithPlugins,
        loaderPath,
      );
      if (lastLoaderCheck.ok) {
        break;
      }

      const missingLibraries = extractMissingLibraries(lastLoaderCheck.output);
      if (missingLibraries.length === 0) {
        break;
      }

      const repaired = copyLibraryClosure(
        missingLibraries,
        pluginSearchPaths,
        dependencyContext.systemLibsDir,
        dependencyContext.copiedNames,
      );
      if (repaired.copiedCount === 0) {
        break;
      }

      console.warn(
        `[bundled-glibc] Added ${repaired.copiedCount} missing gdk-pixbuf loader libraries after check: ${missingLibraries.join(", ")}`,
      );
    }

    if (lastLoaderCheck && !lastLoaderCheck.ok) {
      console.warn(
        `[bundled-glibc] gdk-pixbuf loader dependency check warning for ${loaderPath}:\n${lastLoaderCheck.output}`,
      );
    }
  }

  console.log(
    `[bundled-glibc] Copied ${loaderFiles.length} gdk-pixbuf loaders into ${targetLoadersDir}`,
  );
}

function copyDirectoryResource(sourceDir, targetDir, label) {
  if (!fs.existsSync(sourceDir)) {
    console.warn(`[bundled-glibc] ${label} was not found on build machine: ${sourceDir}`);
    return false;
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`[bundled-glibc] Copied ${label} into ${targetDir}`);
  return true;
}

function collectGtkDataResources(context) {
  const targetShareDir = path.join(context.appOutDir, "resources", SHARE_RESOURCE_DIR_NAME);
  copyDirectoryResource(
    path.join("/usr", "share", "mime"),
    path.join(targetShareDir, "mime"),
    "MIME database",
  );
  copyDirectoryResource(
    path.join("/usr", "share", "glib-2.0", "schemas"),
    path.join(targetShareDir, "glib-2.0", "schemas"),
    "GSettings schemas",
  );
}

function findGioModulesSourceDir() {
  return findFirstDirectory(
    [
      path.join("/usr", "lib", "x86_64-linux-gnu", "gio", "modules"),
      path.join("/usr", "lib64", "gio", "modules"),
      path.join("/usr", "lib", "gio", "modules"),
      path.join("/lib", "x86_64-linux-gnu", "gio", "modules"),
      path.join("/lib64", "gio", "modules"),
      path.join("/lib", "gio", "modules"),
    ],
    null,
  );
}

function collectGioModules(context, dependencyContext) {
  const sourceDir = findGioModulesSourceDir();
  if (!sourceDir) {
    console.warn("[bundled-glibc] GIO module directory was not found on build machine.");
    return;
  }

  const targetDir = path.join(context.appOutDir, "resources", GIO_MODULE_RESOURCE_DIR_NAME);
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });

  const moduleFiles = walkFiles(
    targetDir,
    (filePath) => filePath.endsWith(".so") || filePath.includes(".so."),
  );
  const pluginSearchPaths = unique([targetDir, sourceDir, ...dependencyContext.searchPaths]);
  collectPluginDependencies("GIO module", moduleFiles, pluginSearchPaths, dependencyContext);
  validatePluginDependencies(
    "GIO module",
    context,
    moduleFiles,
    pluginSearchPaths,
    targetDir,
    dependencyContext,
  );
  console.log(`[bundled-glibc] Copied ${moduleFiles.length} GIO modules into ${targetDir}`);
}

function collectNativeTargets(context, executablePath) {
  const nativeRoots = [
    path.join(context.appOutDir, "resources", "app.asar.unpacked"),
    path.join(context.appOutDir, "resources", "koffi"),
  ];
  const appRootNativeFiles = fs
    .readdirSync(context.appOutDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(context.appOutDir, entry.name))
    .filter((filePath) => {
      const basename = path.basename(filePath);
      return (
        basename.endsWith(".so") ||
        basename.includes(".so.") ||
        basename === "chrome_crashpad_handler" ||
        basename === "chrome-sandbox"
      );
    });

  return [
    executablePath,
    ...appRootNativeFiles,
    ...walkFiles(
      nativeRoots[0],
      (filePath) => filePath.endsWith(".node") || filePath.endsWith(".so"),
    ),
    ...walkFiles(
      nativeRoots[1],
      (filePath) => filePath.endsWith(".node") || filePath.endsWith(".so"),
    ),
  ];
}

function collectSystemLibraries(context, sourceDir, executablePath) {
  const systemLibsDir = path.join(context.appOutDir, "resources", SYSTEM_LIBS_DIR_NAME);
  fs.rmSync(systemLibsDir, { recursive: true, force: true });
  fs.mkdirSync(systemLibsDir, { recursive: true });

  const queue = collectNativeTargets(context, executablePath);
  const visited = new Set();
  const copiedNames = new Set();
  const searchPaths = getLibrarySearchPaths(context, sourceDir, systemLibsDir);
  const missing = new Set();
  const missingOptional = new Set();

  const optionalResult = copyLibraryClosure(
    ADDITIONAL_SYSTEM_LIBRARY_BASENAMES,
    searchPaths,
    systemLibsDir,
    copiedNames,
  );
  for (const libraryName of optionalResult.missing) {
    missingOptional.add(libraryName);
  }
  const matchingResult = collectMatchingSystemLibraries(
    ADDITIONAL_SYSTEM_LIBRARY_PATTERNS,
    searchPaths,
    systemLibsDir,
    copiedNames,
  );
  if (matchingResult.copiedCount > 0) {
    console.log(
      `[bundled-glibc] Copied ${matchingResult.copiedCount} pattern-matched system libraries into ${systemLibsDir}`,
    );
  }

  while (queue.length > 0) {
    const current = normalizeExistingPath(queue.shift());
    if (!current || visited.has(current) || !fs.existsSync(current)) {
      continue;
    }
    visited.add(current);

    const dependencies = parseBinaryDependencies(current);
    for (const libraryName of dependencies) {
      const dependencyResult = copyLibraryClosure(
        [libraryName],
        searchPaths,
        systemLibsDir,
        copiedNames,
      );
      if (dependencyResult.missing.size > 0) {
        missing.add(libraryName);
      }
    }
  }

  if (missingOptional.size > 0) {
    console.warn(
      `[bundled-glibc] Optional system libraries not found on build machine: ${[...missingOptional]
        .sort()
        .join(", ")}`,
    );
  }

  console.log(`[bundled-glibc] Copied ${copiedNames.size} system libraries into ${systemLibsDir}`);

  if (missing.size > 0) {
    throw new Error(
      `Missing shared libraries: ${[...missing].sort().join(", ")}. Search paths: ${searchPaths.join(", ")}`,
    );
  }

  return { copiedNames, searchPaths, systemLibsDir };
}

function runPatchelf(args, description) {
  const result = spawnSync("patchelf", args, {
    encoding: "utf8",
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        "patchelf is not available. Install patchelf before building the bundled glibc package.",
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Failed to ${description}`,
        result.stderr || result.stdout || `exit code ${result.status}`,
      ].join(": "),
    );
  }
}

function patchRealExecutable(realExecutablePath, installDir, loaderDirName) {
  const interpreterPath = path.posix.join(
    installDir,
    "resources",
    "glibc",
    loaderDirName,
    "ld-linux-x86-64.so.2",
  );
  const runtimePaths = [
    "$ORIGIN/resources/glibc/lib",
    "$ORIGIN/resources/glibc/lib64",
    "$ORIGIN",
    "$ORIGIN/resources",
    "$ORIGIN/resources/system-libs",
    "$ORIGIN/resources/koffi/linux_x64",
    "$ORIGIN/resources/app.asar.unpacked/node_modules/@openim/electron-client-sdk/assets/linux_x64",
  ].join(":");

  runPatchelf(
    ["--set-interpreter", interpreterPath, realExecutablePath],
    `set bundled glibc interpreter on ${realExecutablePath}`,
  );
  runPatchelf(
    ["--set-rpath", runtimePaths, realExecutablePath],
    `set runtime library path on ${realExecutablePath}`,
  );
}

function getPackagedLibraryPath(appOutDir, glibcDir, systemLibsDir) {
  return [
    path.join(glibcDir, "lib"),
    path.join(glibcDir, "lib64"),
    appOutDir,
    path.join(appOutDir, "resources"),
    systemLibsDir,
    path.join(appOutDir, "resources", "koffi", "linux_x64"),
    path.join(
      appOutDir,
      "resources",
      "app.asar.unpacked",
      "node_modules",
      "@openim",
      "electron-client-sdk",
      "assets",
      "linux_x64",
    ),
  ]
    .filter((dir) => fs.existsSync(dir))
    .join(":");
}

function runRuntimeDependencyCheck(loaderPath, libraryPath, realExecutablePath) {
  const result = spawnSync(
    loaderPath,
    ["--library-path", libraryPath, "--list", realExecutablePath],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        LD_LIBRARY_PATH: libraryPath,
      },
    },
  );
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");

  if (result.error) {
    throw result.error;
  }

  return {
    ok:
      result.status === 0 &&
      !/\bnot found\b/.test(output) &&
      !/error while loading shared libraries/.test(output),
    output,
    status: result.status,
  };
}

function extractMissingLibraries(output) {
  const missing = new Set();
  const errorPattern = /error while loading shared libraries:\s*([^:\s]+):/g;
  const listPattern = /^\s*(\S+)\s+=>\s+not found\b/gm;

  for (const pattern of [errorPattern, listPattern]) {
    let match = pattern.exec(output);
    while (match) {
      missing.add(match[1]);
      match = pattern.exec(output);
    }
  }

  return [...missing];
}

function validateRuntimeLibraries(
  appOutDir,
  glibcDir,
  loaderDirName,
  dependencyContext,
  realExecutablePath,
) {
  const loaderPath = path.join(glibcDir, loaderDirName, "ld-linux-x86-64.so.2");
  const { copiedNames, searchPaths, systemLibsDir } = dependencyContext;
  const libraryPath = getPackagedLibraryPath(appOutDir, glibcDir, systemLibsDir);
  let lastCheck = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    lastCheck = runRuntimeDependencyCheck(loaderPath, libraryPath, realExecutablePath);
    if (lastCheck.ok) {
      console.log(`[bundled-glibc] Runtime dependency check passed for ${realExecutablePath}`);
      return;
    }

    const missingLibraries = extractMissingLibraries(lastCheck.output);
    if (missingLibraries.length === 0) {
      break;
    }

    const repaired = copyLibraryClosure(missingLibraries, searchPaths, systemLibsDir, copiedNames);
    if (repaired.copiedCount === 0) {
      break;
    }

    console.warn(
      `[bundled-glibc] Added ${repaired.copiedCount} missing runtime libraries after check: ${missingLibraries.join(", ")}`,
    );
  }

  if (lastCheck) {
    throw new Error(
      [
        `Bundled runtime dependency check failed for ${realExecutablePath}`,
        lastCheck.output || `exit code ${lastCheck.status}`,
      ].join(":\n"),
    );
  }

  throw new Error(`Bundled runtime dependency check failed for ${realExecutablePath}`);
}

function writeLauncher(executablePath, launcherName, realExecutableName, installDir, loaderDirName) {
  const interpreterPath = path.posix.join(
    installDir,
    "resources",
    "glibc",
    loaderDirName,
    "ld-linux-x86-64.so.2",
  );
const launcher = `#!/usr/bin/env bash
set -eu

SOURCE="\${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  SOURCE_DIR=$(CDPATH= cd -P -- "$(dirname -- "$SOURCE")" && pwd)
  LINK_TARGET=$(readlink "$SOURCE")
  case "$LINK_TARGET" in
    /*) SOURCE="$LINK_TARGET" ;;
    *) SOURCE="$SOURCE_DIR/$LINK_TARGET" ;;
  esac
done
APP_DIR=$(CDPATH= cd -P -- "$(dirname -- "$SOURCE")" && pwd)
GLIBC_DIR="\${OPENCORP_GLIBC_DIR:-$APP_DIR/resources/glibc}"
SYSTEM_LIB_DIR="\${OPENCORP_SYSTEM_LIB_DIR:-$APP_DIR/resources/system-libs}"
GDK_PIXBUF_DIR="$APP_DIR/resources/${GDK_PIXBUF_RESOURCE_DIR_NAME}/${GDK_PIXBUF_VERSION_DIR_NAME}"
APP_SHARE_DIR="$APP_DIR/resources/${SHARE_RESOURCE_DIR_NAME}"
APP_GIO_MODULE_DIR="$APP_DIR/resources/${GIO_MODULE_RESOURCE_DIR_NAME.replace(/\\/g, "/")}"
GTK_IM_RESOURCE_DIR="$APP_DIR/resources/${GTK_IM_RESOURCE_DIR_NAME.replace(/\\/g, "/")}"
GTK_IM_MODULE_FILE_APP="$GTK_IM_RESOURCE_DIR/immodules.cache"
GTK_IM_MODULE_PATH_APP="$GTK_IM_RESOURCE_DIR/immodules"
ICU_DATA_FILE="$APP_DIR/icudtl.dat"
BUNDLED_INTERPRETER="${interpreterPath}"
REAL_EXECUTABLE="$APP_DIR/${realExecutableName}"

if [ -n "\${OPENCORP_LOG_FILE:-}" ]; then
  mkdir -p "$(dirname -- "$OPENCORP_LOG_FILE")" 2>/dev/null || true
  exec >> "$OPENCORP_LOG_FILE" 2>&1
fi

if [ "\${OPENCORP_LAUNCHER_DEBUG:-0}" = "1" ]; then
  if [ -z "\${OPENCORP_LOG_FILE:-}" ]; then
    LOG_BASE="\${XDG_CACHE_HOME:-\${HOME:-/tmp}/.cache}/StickyCake"
    mkdir -p "$LOG_BASE" 2>/dev/null || LOG_BASE="/tmp"
    OPENCORP_LOG_FILE="$LOG_BASE/launcher-$(date +%Y%m%d-%H%M%S).log"
    exec >> "$OPENCORP_LOG_FILE" 2>&1
  fi

  set -x
  echo "[opencorp] launcher debug started at $(date '+%Y-%m-%d %H:%M:%S')"
  echo "[opencorp] APP_DIR=$APP_DIR"
  echo "[opencorp] REAL_EXECUTABLE=$REAL_EXECUTABLE"
  echo "[opencorp] BUNDLED_INTERPRETER=$BUNDLED_INTERPRETER"
  echo "[opencorp] OPENCORP_LOG_FILE=$OPENCORP_LOG_FILE"
  env | sort | grep -E '^(OPENCORP|LD_LIBRARY_PATH|DISPLAY|WAYLAND_DISPLAY|XDG|GDK|GIO|GTK_IM_MODULE|GTK_IM_MODULE_FILE|QT_IM_MODULE|XMODIFIERS|IBUS|FCITX|ICU|HOME|USER)=' || true
fi

if [ ! -x "$BUNDLED_INTERPRETER" ]; then
  echo "Bundled glibc loader not found: $BUNDLED_INTERPRETER" >&2
  exit 127
fi

if [ ! -f "$ICU_DATA_FILE" ]; then
  echo "Electron ICU data not found: $ICU_DATA_FILE" >&2
  exit 127
fi

APP_LIB_PATH="$GLIBC_DIR/lib:$GLIBC_DIR/lib64:$APP_DIR:$APP_DIR/resources:$APP_DIR/resources/koffi/linux_x64:$APP_DIR/resources/app.asar.unpacked/node_modules/@openim/electron-client-sdk/assets/linux_x64:$GDK_PIXBUF_DIR/loaders"
SYSTEM_LIB_PATH="\${OPENCORP_SYSTEM_LIB_PATH:-}"

if [ -z "$SYSTEM_LIB_PATH" ]; then
  if [ -d "$SYSTEM_LIB_DIR" ]; then
    SYSTEM_LIB_PATH="$SYSTEM_LIB_DIR"
  fi
fi

LIB_PATH="$APP_LIB_PATH\${SYSTEM_LIB_PATH:+:$SYSTEM_LIB_PATH}"

GCONV_PATH_VALUE=""
if [ -d "$GLIBC_DIR/lib/gconv" ]; then
  GCONV_PATH_VALUE="$GLIBC_DIR/lib/gconv"
fi
if [ -d "$GLIBC_DIR/lib64/gconv" ]; then
  GCONV_PATH_VALUE="\${GCONV_PATH_VALUE:+$GCONV_PATH_VALUE:}$GLIBC_DIR/lib64/gconv"
fi
if [ -n "$GCONV_PATH_VALUE" ]; then
  export GCONV_PATH="$GCONV_PATH_VALUE\${GCONV_PATH:+:$GCONV_PATH}"
fi

LOCPATH_VALUE=""
if [ -d "$GLIBC_DIR/lib/locale" ]; then
  LOCPATH_VALUE="$GLIBC_DIR/lib/locale"
fi
if [ -d "$GLIBC_DIR/lib64/locale" ]; then
  LOCPATH_VALUE="\${LOCPATH_VALUE:+$LOCPATH_VALUE:}$GLIBC_DIR/lib64/locale"
fi
if [ -n "$LOCPATH_VALUE" ]; then
  export LOCPATH="$LOCPATH_VALUE\${LOCPATH:+:$LOCPATH}"
fi

export ICU_DATA="$APP_DIR"

if [ -d "$GDK_PIXBUF_DIR/loaders" ]; then
  export GDK_PIXBUF_MODULEDIR="$GDK_PIXBUF_DIR/loaders"
  if [ -f "$GDK_PIXBUF_DIR/loaders.cache" ]; then
    export GDK_PIXBUF_MODULE_FILE="$GDK_PIXBUF_DIR/loaders.cache"
  fi
fi

if [ -d "$APP_SHARE_DIR" ]; then
  export XDG_DATA_DIRS="$APP_SHARE_DIR:\${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
fi

if [ -d "$APP_SHARE_DIR/glib-2.0/schemas" ]; then
  export GSETTINGS_SCHEMA_DIR="$APP_SHARE_DIR/glib-2.0/schemas"
fi

if [ -d "$APP_GIO_MODULE_DIR" ]; then
  export GIO_MODULE_DIR="$APP_GIO_MODULE_DIR"
fi

process_exists() {
  command -v pgrep >/dev/null 2>&1 && pgrep -x "$1" >/dev/null 2>&1
}

set_fcitx_env() {
  [ -n "\${GTK_IM_MODULE:-}" ] || export GTK_IM_MODULE=fcitx
  [ -n "\${QT_IM_MODULE:-}" ] || export QT_IM_MODULE=fcitx
  [ -n "\${XMODIFIERS:-}" ] || export XMODIFIERS="@im=fcitx"
}

set_ibus_env() {
  [ -n "\${GTK_IM_MODULE:-}" ] || export GTK_IM_MODULE=ibus
  [ -n "\${QT_IM_MODULE:-}" ] || export QT_IM_MODULE=ibus
  [ -n "\${XMODIFIERS:-}" ] || export XMODIFIERS="@im=ibus"
}

if [ -z "\${GTK_IM_MODULE_FILE:-}" ]; then
  for candidate in \\
    /usr/lib/*-linux-gnu*/gtk-3.0/3.0.0/immodules.cache \\
    /usr/lib64/gtk-3.0/3.0.0/immodules.cache \\
    /usr/lib/gtk-3.0/3.0.0/immodules.cache \\
    /etc/gtk-3.0/gtk.immodules
  do
    if [ -f "$candidate" ]; then
      export GTK_IM_MODULE_FILE="$candidate"
      break
    fi
  done
fi

if [ -f "$GTK_IM_MODULE_FILE_APP" ]; then
  export GTK_IM_MODULE_FILE="$GTK_IM_MODULE_FILE_APP"
fi

if [ -d "$GTK_IM_MODULE_PATH_APP" ]; then
  export GTK_IM_MODULE_PATH="$GTK_IM_MODULE_PATH_APP"
fi

if [ -z "\${GTK_IM_MODULE:-}" ]; then
  case "\${XMODIFIERS:-}" in
    *@im=fcitx*) set_fcitx_env ;;
    *@im=ibus*) set_ibus_env ;;
  esac
fi

if [ -z "\${XMODIFIERS:-}" ]; then
  case "\${GTK_IM_MODULE:-}" in
    fcitx|fcitx5) set_fcitx_env ;;
    ibus) set_ibus_env ;;
  esac
fi

if [ -z "\${GTK_IM_MODULE:-}" ] && [ -z "\${XMODIFIERS:-}" ]; then
  if process_exists fcitx5 || process_exists fcitx || \\
    command -v fcitx5-remote >/dev/null 2>&1 || command -v fcitx-remote >/dev/null 2>&1
  then
    set_fcitx_env
  elif process_exists ibus-daemon || command -v ibus >/dev/null 2>&1; then
    set_ibus_env
  fi
fi

if [ "\${OPENCORP_LAUNCHER_DEBUG:-0}" = "1" ]; then
  echo "[opencorp] final GTK_IM_MODULE=\${GTK_IM_MODULE:-}"
  echo "[opencorp] final GTK_IM_MODULE_FILE=\${GTK_IM_MODULE_FILE:-}"
  echo "[opencorp] final QT_IM_MODULE=\${QT_IM_MODULE:-}"
  echo "[opencorp] final XMODIFIERS=\${XMODIFIERS:-}"
fi

if [ "\${OPENCORP_INHERIT_LD_LIBRARY_PATH:-0}" = "1" ]; then
  export LD_LIBRARY_PATH="$LIB_PATH\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
else
  export LD_LIBRARY_PATH="$LIB_PATH"
fi

exec -a "$APP_DIR/${launcherName}" "$REAL_EXECUTABLE" "$@"
`;

  fs.writeFileSync(executablePath, launcher, { mode: 0o755 });
}

module.exports = async function afterPackBundledGlibc(context) {
  if (context.electronPlatformName !== "linux") {
    return;
  }
  if (process.env.USE_BUNDLED_GLIBC !== "1") {
    return;
  }

  const sourceDir = ensureGlibcSource(context.packager.projectDir);
  const loaderDirName = getGlibcLoaderDirName(sourceDir);
  const installDir = getLinuxInstallDir(context.packager.appInfo);
  const targetDir = path.join(context.appOutDir, "resources", "glibc");
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  ensureGlibcRuntimeAliases(targetDir);

  const executablePath = findExecutable(context.appOutDir, context.packager.appInfo);
  const executableName = path.basename(executablePath);
  const realExecutableName = `${executableName}.real`;
  const realExecutablePath = path.join(context.appOutDir, realExecutableName);

  if (!fs.existsSync(realExecutablePath)) {
    fs.renameSync(executablePath, realExecutablePath);
  } else if (fs.existsSync(executablePath)) {
    fs.rmSync(executablePath, { force: true });
  }

  fs.chmodSync(realExecutablePath, 0o755);
  patchRealExecutable(realExecutablePath, installDir, loaderDirName);
  const dependencyContext = collectSystemLibraries(context, sourceDir, realExecutablePath);
  collectFcitxGtkResources(context, installDir, dependencyContext);
  collectGdkPixbufLoaders(context, installDir, dependencyContext);
  collectGtkDataResources(context);
  collectGioModules(context, dependencyContext);
  validateRuntimeLibraries(
    context.appOutDir,
    targetDir,
    loaderDirName,
    dependencyContext,
    realExecutablePath,
  );
  writeLauncher(
    executablePath,
    path.basename(executablePath),
    realExecutableName,
    installDir,
    loaderDirName,
  );
};
