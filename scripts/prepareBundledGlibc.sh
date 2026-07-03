#!/usr/bin/env bash
set -euo pipefail

ARCH="${1:-x64}"
GLIBC_VERSION="${BUNDLED_GLIBC_VERSION:-2.34}"

if [ "$ARCH" != "x64" ]; then
  echo "Only x64 is supported by this bundled glibc script, got: $ARCH" >&2
  exit 1
fi

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
WORK_DIR="${BUNDLED_GLIBC_WORK_DIR:-$ROOT_DIR/build/bundled-glibc/$ARCH}"
SRC_ROOT="$WORK_DIR/src"
SRC_DIR="$SRC_ROOT/glibc-$GLIBC_VERSION"
BUILD_DIR="$WORK_DIR/build"
INSTALL_DIR="${BUNDLED_GLIBC_INSTALL_DIR:-$WORK_DIR/install}"
TARBALL="$WORK_DIR/glibc-$GLIBC_VERSION.tar.xz"
URL="${BUNDLED_GLIBC_URL:-https://ftp.gnu.org/gnu/libc/glibc-$GLIBC_VERSION.tar.xz}"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)}"
VERSION_FILE="$INSTALL_DIR/.glibc-version"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

download() {
  if command -v wget >/dev/null 2>&1; then
    wget -O "$TARBALL" "$URL"
    return
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -L -o "$TARBALL" "$URL"
    return
  fi
  echo "Missing command: wget or curl" >&2
  exit 1
}

libc_provides_version() {
  if [ ! -f "$INSTALL_DIR/lib/libc.so.6" ]; then
    return 1
  fi

  if command -v readelf >/dev/null 2>&1 \
    && readelf --version-info "$INSTALL_DIR/lib/libc.so.6" 2>/dev/null \
      | awk -v version="GLIBC_$GLIBC_VERSION" 'index($0, version) { found = 1 } END { exit found ? 0 : 1 }'; then
    return 0
  fi

  if command -v strings >/dev/null 2>&1 \
    && strings "$INSTALL_DIR/lib/libc.so.6" \
      | awk -v version="GLIBC_$GLIBC_VERSION" '$0 == version { found = 1 } END { exit found ? 0 : 1 }'; then
    return 0
  fi

  return 1
}

print_libc_versions() {
  echo "Detected GLIBC versions in $INSTALL_DIR/lib/libc.so.6:" >&2
  if command -v readelf >/dev/null 2>&1; then
    readelf --version-info "$INSTALL_DIR/lib/libc.so.6" 2>/dev/null \
      | grep -o 'GLIBC_[0-9][0-9.]*' \
      | sort -Vu \
      | tail -30 >&2 || true
    return
  fi

  if command -v strings >/dev/null 2>&1; then
    strings "$INSTALL_DIR/lib/libc.so.6" \
      | grep -o 'GLIBC_[0-9][0-9.]*' \
      | sort -Vu \
      | tail -30 >&2 || true
  fi
}

has_expected_install() {
  if [ ! -x "$INSTALL_DIR/lib/ld-linux-x86-64.so.2" ] || [ ! -f "$INSTALL_DIR/lib/libc.so.6" ]; then
    return 1
  fi

  if [ -f "$VERSION_FILE" ] && [ "$(cat "$VERSION_FILE")" = "$GLIBC_VERSION" ]; then
    return 0
  fi

  if libc_provides_version; then
    echo "$GLIBC_VERSION" >"$VERSION_FILE"
    return 0
  fi

  return 1
}

if has_expected_install; then
  echo "Bundled glibc $GLIBC_VERSION already exists: $INSTALL_DIR"
  exit 0
fi

if [ -e "$INSTALL_DIR" ]; then
  case "$INSTALL_DIR" in
    "$WORK_DIR"/*)
      echo "Removing stale bundled glibc at $INSTALL_DIR; expected glibc $GLIBC_VERSION."
      rm -rf "$INSTALL_DIR"
      ;;
    *)
      echo "Bundled glibc exists but does not provide GLIBC_$GLIBC_VERSION: $INSTALL_DIR" >&2
      echo "Remove it manually or set BUNDLED_GLIBC_INSTALL_DIR to a clean directory." >&2
      exit 1
      ;;
  esac
fi

need_command gcc
need_command make
need_command gawk
need_command bison
need_command python3
need_command tar
need_command xz
need_command readelf

mkdir -p "$WORK_DIR" "$SRC_ROOT"

if [ ! -d "$SRC_DIR" ]; then
  if [ ! -f "$TARBALL" ]; then
    echo "Downloading glibc $GLIBC_VERSION..."
    download
  fi

  echo "Extracting glibc $GLIBC_VERSION..."
  tar -C "$SRC_ROOT" -xf "$TARBALL"
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$INSTALL_DIR"

cd "$BUILD_DIR"

"$SRC_DIR/configure" \
  --prefix="$INSTALL_DIR" \
  --libdir="$INSTALL_DIR/lib" \
  --enable-kernel=3.10 \
  --disable-werror

make -j"$JOBS"
make install

if ! libc_provides_version; then
  echo "Installed glibc does not provide GLIBC_$GLIBC_VERSION: $INSTALL_DIR/lib/libc.so.6" >&2
  print_libc_versions
  exit 1
fi

echo "$GLIBC_VERSION" >"$VERSION_FILE"
"$INSTALL_DIR/lib/ld-linux-x86-64.so.2" --version
echo "Bundled glibc installed at: $INSTALL_DIR"
