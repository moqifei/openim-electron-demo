#!/bin/sh
set -eu

APP_NAME="StickyCake"
DISPLAY_NAME="年糕"
EXECUTABLE_NAME="年糕"
APP_ID="io.opencorp.desktop.base"
APP_DIR="/opt/StickyCake"
SYSTEM_BIN_DIR="/usr/bin"
SYSTEM_APPLICATIONS_DIR="/usr/share/applications"
SHORTCUT_NAME="年糕.desktop"
LEGACY_SHORTCUT_NAME="opencorp-base.desktop"
MANAGED_MARKER="X-OpenCorp-Base-Managed-Desktop-Shortcut=true"
POSTINST_LOG="/tmp/StickyCake-postinst.log"

log() {
  printf '%s\n' "$*" >> "$POSTINST_LOG" 2>/dev/null || true
}

configure_chrome_sandbox() {
  sandbox_path="$APP_DIR/chrome-sandbox"

  if [ ! -f "$sandbox_path" ]; then
    log "chrome-sandbox not found: $sandbox_path"
    return 0
  fi

  chown root:root "$sandbox_path" 2>/dev/null || true
  chmod 4755 "$sandbox_path" 2>/dev/null || true
  log "configured chrome-sandbox: $(ls -l "$sandbox_path" 2>/dev/null || true)"
}

ensure_application_symlink() {
  target="$SYSTEM_BIN_DIR/$EXECUTABLE_NAME"
  mkdir -p "$SYSTEM_BIN_DIR"
  ln -sfn "$APP_DIR/$EXECUTABLE_NAME" "$target"
  log "updated application symlink: $target -> $(readlink "$target" 2>/dev/null || true)"
}

normalize_desktop_file() {
  target="$1"

  if grep -q '^Name' "$target" 2>/dev/null; then
    sed -i "s/^Name\\(\\[[^]]*\\]\\)\\?=.*/Name\\1=$DISPLAY_NAME/" "$target"
  else
    sed -i "/^\[Desktop Entry\]/a Name=$DISPLAY_NAME" "$target" 2>/dev/null || true
  fi

  if grep -q '^Exec=' "$target" 2>/dev/null; then
    sed -i "s|^Exec=.*|Exec=$APP_DIR/$EXECUTABLE_NAME %U|" "$target"
  else
    sed -i "/^\[Desktop Entry\]/a Exec=$APP_DIR/$EXECUTABLE_NAME %U" "$target" 2>/dev/null || true
  fi

  if grep -q '^Icon=' "$target" 2>/dev/null; then
    sed -i "s|^Icon=.*|Icon=$APP_DIR/resources/dist/icons/icon-new.png|" "$target"
  else
    sed -i "/^\[Desktop Entry\]/a Icon=$APP_DIR/resources/dist/icons/icon-new.png" "$target" 2>/dev/null || true
  fi
}

find_source_desktop() {
  for candidate in \
    "$SYSTEM_APPLICATIONS_DIR/${EXECUTABLE_NAME}.desktop" \
    "$SYSTEM_APPLICATIONS_DIR/${APP_NAME}.desktop" \
    "$SYSTEM_APPLICATIONS_DIR/${APP_ID}.desktop"
  do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  found="$(find "$SYSTEM_APPLICATIONS_DIR" -maxdepth 1 -type f -name '*.desktop' \
    -exec grep -l "$EXECUTABLE_NAME" {} \; 2>/dev/null | head -n 1 || true)"
  if [ -n "$found" ]; then
    printf '%s\n' "$found"
    return 0
  fi

  return 1
}

remove_legacy_system_desktop() {
  legacy_desktop="$SYSTEM_APPLICATIONS_DIR/$LEGACY_SHORTCUT_NAME"

  if [ ! -f "$legacy_desktop" ]; then
    return 0
  fi

  if grep -q "^$MANAGED_MARKER$" "$legacy_desktop" 2>/dev/null || \
    grep -Fq 'Exec=/opt/OpenCorp-Base/opencorp-base' "$legacy_desktop" 2>/dev/null
  then
    rm -f "$legacy_desktop"
    log "removed legacy system desktop file: $legacy_desktop"
  fi
}

create_fallback_desktop() {
  fallback="$SYSTEM_APPLICATIONS_DIR/$SHORTCUT_NAME"
  mkdir -p "$SYSTEM_APPLICATIONS_DIR"
  cat > "$fallback" <<EOF
[Desktop Entry]
Name=$DISPLAY_NAME
Exec=/opt/StickyCake/年糕 %U
Terminal=false
Type=Application
Icon=/opt/StickyCake/resources/dist/icons/icon-new.png
StartupWMClass=$APP_NAME
Categories=Utility;
$MANAGED_MARKER
EOF
  chmod 644 "$fallback"
  printf '%s\n' "$fallback"
}

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

  if [ -d "$home_dir/Desktop" ]; then
    append_unique_line "$home_dir/Desktop" "$candidates_file"
  fi

  if command -v su >/dev/null 2>&1 && command -v xdg-user-dir >/dev/null 2>&1; then
    desktop_dir="$(su - "$user" -c 'xdg-user-dir DESKTOP' 2>/dev/null || true)"
    case "$desktop_dir" in
      "$home_dir" | "") ;;
      *)
        if [ -d "$desktop_dir" ]; then
          append_unique_line "$desktop_dir" "$candidates_file"
        fi
        ;;
    esac
  fi

  user_dirs_config="$home_dir/.config/user-dirs.dirs"
  if [ -f "$user_dirs_config" ]; then
    configured_desktop="$(grep '^XDG_DESKTOP_DIR=' "$user_dirs_config" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"' || true)"
    case "$configured_desktop" in
      '$HOME'/*) configured_desktop="$home_dir/${configured_desktop#'$HOME'/}" ;;
    esac
    case "$configured_desktop" in
      "$home_dir"/* | /*)
        if [ -d "$configured_desktop" ]; then
          append_unique_line "$configured_desktop" "$candidates_file"
        fi
        ;;
    esac
  fi

  zh_desktop_name="$(printf '\346\241\214\351\235\242')"
  if [ -d "$home_dir/$zh_desktop_name" ]; then
    append_unique_line "$home_dir/$zh_desktop_name" "$candidates_file"
  fi

  cat "$candidates_file"
  rm -f "$candidates_file"
}

install_shortcut_for_user() {
  user="$1"
  uid="$2"
  gid="$3"
  home_dir="$4"
  source_desktop="$5"

  if [ ! -d "$home_dir" ]; then
    return 0
  fi

  desktop_dirs_for_user "$user" "$home_dir" | while IFS= read -r desktop_dir; do
    install_shortcut_to_desktop_dir "$user" "$uid" "$gid" "$desktop_dir" "$source_desktop"
  done
}

install_shortcut_to_desktop_dir() {
  user="$1"
  uid="$2"
  gid="$3"
  desktop_dir="$4"
  source_desktop="$5"

  if [ -z "$desktop_dir" ]; then
    return 0
  fi

  if [ ! -d "$desktop_dir" ]; then
    log "desktop dir not found for $user: $desktop_dir"
    return 0
  fi

  target="$desktop_dir/$SHORTCUT_NAME"
  legacy_target="$desktop_dir/$LEGACY_SHORTCUT_NAME"
  if [ -f "$legacy_target" ] && grep -q "^$MANAGED_MARKER$" "$legacy_target" 2>/dev/null; then
    rm -f "$legacy_target"
    log "removed legacy desktop shortcut for $user: $legacy_target"
  fi

  cp "$source_desktop" "$target"
  normalize_desktop_file "$target"

  if ! grep -q "^$MANAGED_MARKER$" "$target" 2>/dev/null; then
    printf '\n%s\n' "$MANAGED_MARKER" >> "$target"
  fi

  chmod 755 "$target"
  chown "$uid:$gid" "$target" 2>/dev/null || chown "$user:$user" "$target" 2>/dev/null || true
  if command -v su >/dev/null 2>&1 && command -v gio >/dev/null 2>&1; then
    su - "$user" -c "gio set '$target' metadata::trusted true" >/dev/null 2>&1 || true
  fi
  log "created desktop shortcut for $user: $target"
}

append_user_candidate() {
  user="$1"
  candidates_file="$2"

  if [ -z "$user" ] || [ "$user" = "root" ]; then
    return 0
  fi

  user_entry="$(getent passwd "$user" 2>/dev/null || true)"
  if [ -z "$user_entry" ]; then
    return 0
  fi

  uid="$(printf '%s' "$user_entry" | cut -d: -f3)"
  gid="$(printf '%s' "$user_entry" | cut -d: -f4)"
  home_dir="$(printf '%s' "$user_entry" | cut -d: -f6)"
  line="$user:$uid:$gid:$home_dir"

  if [ -d "$home_dir" ] && ! grep -Fxq "$line" "$candidates_file" 2>/dev/null; then
    printf '%s\n' "$line" >> "$candidates_file"
  fi
}

append_loginctl_desktop_users() {
  candidates_file="$1"

  if ! command -v loginctl >/dev/null 2>&1; then
    return 0
  fi

  loginctl list-sessions --no-legend 2>/dev/null | while read -r session_id _rest; do
    if [ -z "$session_id" ]; then
      continue
    fi

    session_info="$(loginctl show-session "$session_id" \
      -p Name -p Active -p State -p Type -p Class -p Remote -p Display 2>/dev/null || true)"
    user="$(printf '%s\n' "$session_info" | awk -F= '$1 == "Name" { print $2 }')"
    active="$(printf '%s\n' "$session_info" | awk -F= '$1 == "Active" { print $2 }')"
    state="$(printf '%s\n' "$session_info" | awk -F= '$1 == "State" { print $2 }')"
    type="$(printf '%s\n' "$session_info" | awk -F= '$1 == "Type" { print $2 }')"
    class="$(printf '%s\n' "$session_info" | awk -F= '$1 == "Class" { print $2 }')"
    remote="$(printf '%s\n' "$session_info" | awk -F= '$1 == "Remote" { print $2 }')"
    display="$(printf '%s\n' "$session_info" | awk -F= '$1 == "Display" { print $2 }')"

    if [ -z "$user" ] || [ "$remote" = "yes" ]; then
      continue
    fi

    if [ -n "$class" ] && [ "$class" != "user" ]; then
      continue
    fi

    case "$active:$state" in
      yes:* | *:active) ;;
      *) continue ;;
    esac

    case "$type:$display" in
      x11:* | wayland:* | *::*) append_user_candidate "$user" "$candidates_file" ;;
      *) ;;
    esac
  done
}

append_who_users() {
  candidates_file="$1"

  if ! command -v who >/dev/null 2>&1; then
    return 0
  fi

  who 2>/dev/null | awk '{ print $1 }' | while read -r user; do
    append_user_candidate "$user" "$candidates_file"
  done
}

install_shortcuts_for_logged_in_users() {
  source_desktop="$1"
  candidates_file="$(mktemp)"

  append_user_candidate "${OPENCORP_DESKTOP_USER:-}" "$candidates_file"
  append_user_candidate "${SUDO_USER:-}" "$candidates_file"
  append_loginctl_desktop_users "$candidates_file"

  if [ ! -s "$candidates_file" ]; then
    append_who_users "$candidates_file"
  fi

  if [ -s "$candidates_file" ]; then
    log "desktop shortcut candidate users:"
    cat "$candidates_file" >> "$POSTINST_LOG" 2>/dev/null || true
    while IFS=: read -r user uid gid home_dir; do
      install_shortcut_for_user "$user" "$uid" "$gid" "$home_dir" "$source_desktop"
    done < "$candidates_file"
  else
    log "no logged-in desktop user detected, falling back to existing /home desktop dirs"
    install_shortcuts_for_existing_home_desktops "$source_desktop"
  fi

  rm -f "$candidates_file"
}

install_shortcuts_for_existing_home_desktops() {
  source_desktop="$1"
  zh_desktop_name="$(printf '\346\241\214\351\235\242')"

  for desktop_dir in /home/*/Desktop /home/*/"$zh_desktop_name"; do
    if [ ! -d "$desktop_dir" ]; then
      continue
    fi

    home_dir="$(dirname "$desktop_dir")"
    user="$(basename "$home_dir")"
    uid="$(stat -c '%u' "$desktop_dir" 2>/dev/null || printf '0')"
    gid="$(stat -c '%g' "$desktop_dir" 2>/dev/null || printf '0')"
    install_shortcut_to_desktop_dir "$user" "$uid" "$gid" "$desktop_dir" "$source_desktop"
  done
}

log "postinst started as user $(id -u 2>/dev/null || true), SUDO_USER=${SUDO_USER:-}"
configure_chrome_sandbox
ensure_application_symlink
remove_legacy_system_desktop

source_desktop="$(find_source_desktop || create_fallback_desktop)"
normalize_desktop_file "$source_desktop"
log "source desktop file: $source_desktop"

install_shortcuts_for_logged_in_users "$source_desktop"

exit 0
