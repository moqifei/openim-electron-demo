#!/bin/sh
set -eu

SYSTEM_APPLICATIONS_DIR="/usr/share/applications"
SHORTCUT_NAME="stickycake.desktop"
LEGACY_SHORTCUT_NAME="opencorp-base.desktop"
MANAGED_MARKER="X-OpenCorp-Base-Managed-Desktop-Shortcut=true"

append_unique_line() {
  value="$1"
  file="$2"

  if [ -n "$value" ] && ! grep -Fxq "$value" "$file" 2>/dev/null; then
    printf '%s\n' "$value" >> "$file"
  fi
}

desktop_dirs_for_user() {
  user="$1"
  home_dir="$2"
  candidates_file="$(mktemp)"

  append_unique_line "$home_dir/Desktop" "$candidates_file"

  if command -v su >/dev/null 2>&1 && command -v xdg-user-dir >/dev/null 2>&1; then
    desktop_dir="$(su - "$user" -c 'xdg-user-dir DESKTOP' 2>/dev/null || true)"
    case "$desktop_dir" in
      "$home_dir" | "") ;;
      *) append_unique_line "$desktop_dir" "$candidates_file" ;;
    esac
  fi

  user_dirs_config="$home_dir/.config/user-dirs.dirs"
  if [ -f "$user_dirs_config" ]; then
    configured_desktop="$(grep '^XDG_DESKTOP_DIR=' "$user_dirs_config" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"' || true)"
    case "$configured_desktop" in
      '$HOME'/*) append_unique_line "$home_dir/${configured_desktop#'$HOME'/}" "$candidates_file" ;;
      "$home_dir"/*) append_unique_line "$configured_desktop" "$candidates_file" ;;
      /*) append_unique_line "$configured_desktop" "$candidates_file" ;;
    esac
  fi

  zh_desktop_name="$(printf '\346\241\214\351\235\242')"
  if [ -d "$home_dir/$zh_desktop_name" ]; then
    append_unique_line "$home_dir/$zh_desktop_name" "$candidates_file"
  fi

  cat "$candidates_file"
  rm -f "$candidates_file"
}

remove_shortcut_for_user() {
  user="$1"
  home_dir="$2"

  desktop_dirs_for_user "$user" "$home_dir" | while IFS= read -r desktop_dir; do
    remove_shortcut_from_desktop_dir "$desktop_dir"
  done
}

remove_shortcut_from_desktop_dir() {
  desktop_dir="$1"

  for shortcut_name in "$SHORTCUT_NAME" "$LEGACY_SHORTCUT_NAME"; do
    target="$desktop_dir/$shortcut_name"
    if [ -f "$target" ] && grep -q "^$MANAGED_MARKER$" "$target" 2>/dev/null; then
      rm -f "$target"
    fi
  done
}

remove_system_fallbacks() {
  for shortcut_name in "$SHORTCUT_NAME" "$LEGACY_SHORTCUT_NAME"; do
    target="$SYSTEM_APPLICATIONS_DIR/$shortcut_name"
    if [ ! -f "$target" ]; then
      continue
    fi

    if grep -q "^$MANAGED_MARKER$" "$target" 2>/dev/null; then
      rm -f "$target"
      continue
    fi

    if [ "$shortcut_name" = "$LEGACY_SHORTCUT_NAME" ] && \
      grep -Fq 'Exec=/opt/OpenCorp-Base/opencorp-base' "$target" 2>/dev/null
    then
      rm -f "$target"
    fi
  done
}

remove_shortcuts_from_home_desktops() {
  zh_desktop_name="$(printf '\346\241\214\351\235\242')"

  for desktop_dir in /home/*/Desktop /home/*/"$zh_desktop_name"; do
    if [ -d "$desktop_dir" ]; then
      remove_shortcut_from_desktop_dir "$desktop_dir"
    fi
  done
}

getent passwd | awk -F: '($3 >= 1000 && $3 < 60000 && $6 ~ "^/home/") { print $1 ":" $6 }' |
while IFS=: read -r user home_dir; do
  remove_shortcut_for_user "$user" "$home_dir"
done

remove_shortcuts_from_home_desktops
remove_system_fallbacks

exit 0
