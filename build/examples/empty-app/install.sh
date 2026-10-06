#!/bin/sh
set -eu

# Identical success output across all NC35 app installers. On failure the
# complete command log is retained for the user and printed to stderr.
if [ "${HC_INSTALL_VERBOSE_INTERNAL:-0}" != "1" ]; then
    INSTALL_LOG="$(mktemp)"
    trap 'rm -f "$INSTALL_LOG"' EXIT HUP INT TERM
    if HC_INSTALL_VERBOSE_INTERNAL=1 sh "$0" >"$INSTALL_LOG" 2>&1; then
        APP_INFO="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/src/appinfo/info.xml"
        APP_ID="$(sed -n 's:.*<id>\([^<]*\)</id>.*:\1:p' "$APP_INFO" | head -n 1)"
        APP_NAME="$(sed -n 's:.*<name>\([^<]*\)</name>.*:\1:p' "$APP_INFO" | head -n 1 | sed 's/&amp;/\&/g')"
        NEW_VERSION="$(sed -n 's:.*<version>\([^<]*\)</version>.*:\1:p' "$APP_INFO" | head -n 1)"
        OLD_VERSION="$(sed -n 's/^Install previous version: //p' "$INSTALL_LOG" | head -n 1)"
        WEB_NAME="$(sed -n 's/^Nextcloud web container: //p' "$INSTALL_LOG" | head -n 1)"
        if [ -z "$APP_ID" ] || [ -z "$NEW_VERSION" ] || [ -z "$OLD_VERSION" ] || [ -z "$WEB_NAME" ]; then
            cat "$INSTALL_LOG" >&2
            echo 'ERROR: Could not verify the installation summary.' >&2
            exit 1
        fi
        SIZE_KIB="$(docker exec "$WEB_NAME" du -sk "/var/www/html/custom_apps/$APP_ID" 2>/dev/null | awk 'NR==1 {print $1}')"
        case "$SIZE_KIB" in ''|*[!0-9]*) SIZE_KIB="$(du -sk "$(dirname "$APP_INFO")/.." | awk 'NR==1 {print $1}')";; esac
        printf 'Aplikace: %s\nVerze: %s -> %s\nVelikost instalace: %s KiB\nHotovo.\n' "${APP_NAME:-$APP_ID}" "$OLD_VERSION" "$NEW_VERSION" "$SIZE_KIB"
        grep '^WARNING:' "$INSTALL_LOG" >&2 || true
        exit 0
    else
        STATUS=$?
        cat "$INSTALL_LOG" >&2
        exit "$STATUS"
    fi
fi

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$PROJECT_DIR/src"
INFO="$APP_DIR/appinfo/info.xml"
[ -f "$INFO" ] || { echo "ERROR: $INFO not found" >&2; exit 1; }
APP_ID="$(sed -n 's:.*<id>\([^<]*\)</id>.*:\1:p' "$INFO" | head -n 1)"
APP_NAME="$(sed -n 's:.*<name>\([^<]*\)</name>.*:\1:p' "$INFO" | head -n 1)"
MIN_NC_MAJOR="$(sed -n 's:.*<nextcloud[^>]*min-version="\([0-9][0-9]*\)".*:\1:p' "$INFO" | head -n 1)"
MAX_NC_MAJOR="$(sed -n 's:.*<nextcloud[^>]*max-version="\([0-9][0-9]*\)".*:\1:p' "$INFO" | head -n 1)"
[ -n "$APP_ID" ] || { echo "ERROR: app id not found" >&2; exit 1; }
[ -n "$APP_NAME" ] || APP_NAME="$APP_ID"
WEB_CONTAINER=""; CRON_CONTAINER=""
say(){ printf '%s\n' "$*"; }; die(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Run this installer with: sudo sh install.sh"
chmod 755 "$0" 2>/dev/null || true
command -v docker >/dev/null 2>&1 || die "Docker was not found."
LOCK_DIR="$PROJECT_DIR/.hc-install-lock"
mkdir "$LOCK_DIR" 2>/dev/null || die "Another installation or an interrupted install lock exists: $LOCK_DIR"
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT HUP INT TERM
RUNTIME_ITEMS="appinfo css img js lib templates"
container_has_occ(){ docker exec "$1" sh -c 'test -f /var/www/html/occ' >/dev/null 2>&1; }
if docker ps --format '{{.Names}}' | grep -qx 'nextcloud-app' && container_has_occ nextcloud-app; then WEB_CONTAINER=nextcloud-app; fi
if docker ps --format '{{.Names}}' | grep -qx 'nextcloud-cron' && container_has_occ nextcloud-cron; then CRON_CONTAINER=nextcloud-cron; fi
if [ -z "$WEB_CONTAINER" ]; then
 for c in $(docker ps --format '{{.Names}}' | grep -Ei 'nextcloud' || true); do case "$c" in *cron*) continue;; esac; if container_has_occ "$c"; then WEB_CONTAINER="$c"; break; fi; done
fi
if [ -z "$CRON_CONTAINER" ]; then
 for c in $(docker ps --format '{{.Names}}' | grep -Ei 'nextcloud.*cron|cron.*nextcloud' || true); do if container_has_occ "$c"; then CRON_CONTAINER="$c"; break; fi; done
fi
[ -n "$WEB_CONTAINER" ] || die "Could not find the Nextcloud web container."
say "Nextcloud web container: $WEB_CONTAINER"; [ -n "$CRON_CONTAINER" ] && say "Nextcloud cron container: $CRON_CONTAINER"

# Repair previous duplicate application trees before Nextcloud scans custom_apps.
. "$PROJECT_DIR/scripts/custom-apps-safety.sh"
hc_clean_custom_apps "$APP_ID" "$WEB_CONTAINER" "$CRON_CONTAINER" || die "Could not safely move duplicate application trees out of custom_apps."
NC_STATUS="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ status --output=json 2>/dev/null || true)"
NC_VERSION="$(printf '%s' "$NC_STATUS" | sed -n 's/.*"versionstring":"\([^"]*\)".*/\1/p')"
[ -n "$NC_VERSION" ] || die "Cannot determine Nextcloud version; deployment stopped."
if [ -n "$NC_VERSION" ]; then
 say "Nextcloud version: $NC_VERSION"; NC_MAJOR="$(printf '%s' "$NC_VERSION" | cut -d. -f1)"
 case "$NC_MAJOR" in ''|*[!0-9]*) die "Invalid Nextcloud version." ;; *)
  [ -z "$MIN_NC_MAJOR" ] || [ "$NC_MAJOR" -ge "$MIN_NC_MAJOR" ] || die "$APP_NAME requires Nextcloud $MIN_NC_MAJOR or newer."
  [ -z "$MAX_NC_MAJOR" ] || [ "$NC_MAJOR" -le "$MAX_NC_MAJOR" ] || die "$APP_NAME supports Nextcloud up to major $MAX_NC_MAJOR."
 ;; esac
fi
for item in $RUNTIME_ITEMS; do [ -e "$APP_DIR/$item" ] || die "Required application item is missing in src/: $item"; done
SOURCE_VERSION="$(sed -n 's:.*<version>\([^<]*\)</version>.*:\1:p' "$INFO" | head -n 1)"; [ -n "$SOURCE_VERSION" ] || die "Could not determine app version."
say "$APP_NAME source version: $SOURCE_VERSION"
case "$APP_ID" in ''|*[!a-z0-9_]*) die "Invalid application id.";; esac
INSTALLED_VERSION="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ config:app:get "$APP_ID" installed_version 2>/dev/null || true)"
say "Install previous version: ${INSTALLED_VERSION:-nová instalace}"
if [ -n "$INSTALLED_VERSION" ]; then
 docker exec "$WEB_CONTAINER" php -r 'exit(version_compare($argv[1], $argv[2], ">") ? 1 : 0);' "$INSTALLED_VERSION" "$SOURCE_VERSION" || die "Downgrade refused: $INSTALLED_VERSION -> $SOURCE_VERSION. Restore a matched code/database backup instead."
fi
CORE_LIST="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:list --enabled --output=json 2>/dev/null | tr -d '\n\r ' || true)"
CORE_VERSION="$(printf '%s' "$CORE_LIST" | sed -n 's/.*"hc_shared_app_core":"\([^"]*\)".*/\1/p')"
CORE_CONTRACT="$APP_DIR/appinfo/hc_shared_app_core.json"
[ -f "$CORE_CONTRACT" ] || die "Missing Core contract: $CORE_CONTRACT"
REQUIRED_CORE_VERSION="$(sed -n 's/.*"requiredVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CORE_CONTRACT" | head -n 1)"
[ -n "$REQUIRED_CORE_VERSION" ] || die "Core contract has no requiredVersion."
if [ -z "$CORE_VERSION" ]; then
 say "WARNING: Shared App Core is not installed or enabled. Installation will continue so the browser guard can display recovery instructions."
elif ! docker exec "$WEB_CONTAINER" php -r 'exit(version_compare($argv[1], $argv[2], ">=") ? 0 : 1);' "$CORE_VERSION" "$REQUIRED_CORE_VERSION"; then
 say "WARNING: Shared App Core $CORE_VERSION is older than required $REQUIRED_CORE_VERSION. Installation will continue so the browser guard can report the mismatch."
else
 say "Shared App Core version: $CORE_VERSION"
fi
DATA_DIRECTORY="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ config:system:get datadirectory)"
case "$DATA_DIRECTORY" in /*) ;; *) die "Cannot locate Nextcloud data directory for deployment backup.";; esac
TMP_LOCAL="$(mktemp -d)"; trap 'hc_cleanup_install_stage; rm -rf "$TMP_LOCAL"; rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT HUP INT TERM
STAGE="$TMP_LOCAL/$APP_ID"; mkdir -p "$STAGE"
for item in $RUNTIME_ITEMS; do cp -R "$APP_DIR/$item" "$STAGE/"; done
TARGET_DIR="/var/www/html/custom_apps/$APP_ID"; BACKUP_DIR="${DATA_DIRECTORY}/hc-core-deployment-backups/${APP_ID}.$(date +%Y%m%d%H%M%S).$$"; REMOTE_TMP="/tmp/${APP_ID}.install.$$"
docker exec "$WEB_CONTAINER" sh -c 'mkdir -p /var/www/html/custom_apps'
docker exec "$WEB_CONTAINER" rm -rf "$REMOTE_TMP" >/dev/null 2>&1 || true
docker exec "$WEB_CONTAINER" mkdir -p "$REMOTE_TMP"; docker cp "$STAGE/." "$WEB_CONTAINER:$REMOTE_TMP/"
docker exec "$WEB_CONTAINER" chown -R www-data:www-data "$REMOTE_TMP"
# Validate all staged PHP before touching the enabled runtime.
docker exec "$WEB_CONTAINER" sh -c 'find "$1" -type f -name "*.php" -exec php -l {} \;' sh "$REMOTE_TMP" >"$TMP_LOCAL/php-lint.log" 2>&1 || { cat "$TMP_LOCAL/php-lint.log"; die "Staged PHP validation failed."; }
if grep -q 'Errors parsing' "$TMP_LOCAL/php-lint.log"; then cat "$TMP_LOCAL/php-lint.log"; die "Staged PHP validation failed."; fi
if docker exec "$WEB_CONTAINER" sh -c "test -d '$TARGET_DIR'"; then
 if docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:list --enabled 2>/dev/null | grep -q -- "- $APP_ID:"; then docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:disable "$APP_ID"; fi
 docker exec "$WEB_CONTAINER" mkdir -p "$BACKUP_DIR"
 docker exec "$WEB_CONTAINER" mv "$TARGET_DIR" "$BACKUP_DIR/runtime"
 say "Previous runtime retained: $BACKUP_DIR/runtime"
fi
if ! docker exec "$WEB_CONTAINER" mv "$REMOTE_TMP" "$TARGET_DIR"; then
 docker exec "$WEB_CONTAINER" sh -c 'test ! -d "$1/runtime" || mv "$1/runtime" "$2"' sh "$BACKUP_DIR" "$TARGET_DIR" >/dev/null 2>&1 || true
 die "Could not place the validated runtime; previous runtime was restored where possible."
fi
docker exec "$WEB_CONTAINER" chown -R www-data:www-data "$TARGET_DIR"
# Probe the exact newly deployed tree, not just whether info.xml exists.
PROBE_FILE=".hc-deploy-probe-$$"
docker exec "$WEB_CONTAINER" touch "$TARGET_DIR/$PROBE_FILE"
if [ -n "$CRON_CONTAINER" ] && [ "$CRON_CONTAINER" != "$WEB_CONTAINER" ]; then
 if docker exec "$CRON_CONTAINER" test -f "$TARGET_DIR/$PROBE_FILE"; then
  say "Cron sees the same deployed application tree."
 else
  CRON_TMP="/tmp/${APP_ID}.install.$$"
  docker exec "$CRON_CONTAINER" mkdir -p "$CRON_TMP"
  docker cp "$STAGE/." "$CRON_CONTAINER:$CRON_TMP/"
  docker exec "$CRON_CONTAINER" sh -c 'set -eu; target="$1"; stage="$2"; backup="$3"; mkdir -p "$(dirname "$target")" "$backup"; if [ -d "$target" ]; then mv "$target" "$backup/runtime"; fi; mv "$stage" "$target"; chown -R www-data:www-data "$target"' sh "$TARGET_DIR" "$CRON_TMP" "$BACKUP_DIR"
 fi
fi
docker exec "$WEB_CONTAINER" rm -f "$TARGET_DIR/$PROBE_FILE"
docker exec "$WEB_CONTAINER" php -r 'if (function_exists("opcache_reset")) { opcache_reset(); }' >/dev/null 2>&1 || true
docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:enable "$APP_ID"
docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ upgrade
if docker exec "$WEB_CONTAINER" sh -c 'command -v apache2ctl >/dev/null 2>&1'; then
 docker exec "$WEB_CONTAINER" apache2ctl -k graceful || die "Apache reload failed."
elif docker exec "$WEB_CONTAINER" sh -c 'test -r /proc/1/comm && grep -qi php-fpm /proc/1/comm'; then
 docker exec "$WEB_CONTAINER" kill -USR2 1 || die "PHP-FPM reload failed."
fi
CONFIG_VERSION="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ config:app:get "$APP_ID" installed_version)"
[ "$CONFIG_VERSION" = "$SOURCE_VERSION" ] || die "Installed version does not match source."

DEPLOYED_VERSION="$(docker exec "$WEB_CONTAINER" sh -c "grep -o '<version>[^<]*</version>' '$TARGET_DIR/appinfo/info.xml' | sed 's#<version>##;s#</version>##'" 2>/dev/null || true)"
[ "$DEPLOYED_VERSION" = "$SOURCE_VERSION" ] || die "Version verification failed. Source: $SOURCE_VERSION, deployed: $DEPLOYED_VERSION"
for item in $RUNTIME_ITEMS; do docker exec "$WEB_CONTAINER" sh -c "test -e '$TARGET_DIR/$item'" || die "Deployment verification failed. Missing: $TARGET_DIR/$item"; done
say "$APP_NAME version: $DEPLOYED_VERSION"; say "Filesystem/installed-version verification: OK; browser startup and maps require runtime qualification."; say "$APP_NAME deployment finished successfully."
