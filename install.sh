#!/bin/sh
set -eu

# Úspěšná instalace vypíše stejné čtyři řádky ve všech aplikacích.
# Při chybě se místo toho zobrazí celý protokol.
if [ "${HC_INSTALL_VERBOSE_INTERNAL:-0}" != "1" ]; then
    INSTALL_LOG="$(mktemp)"
    trap 'rm -f "$INSTALL_LOG"' EXIT
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
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
LEGACY_APP_ID="appcore"
say(){ printf '%s\n' "$*"; }; die(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
# Selhat ještě před čištěním custom_apps, zakázáním aplikace nebo prací s DB.
for file in scripts/custom-apps-safety.sh scripts/install-transaction.sh scripts/ensure-schema.php build/tests/php/cache.php build/tools/verify-core-install.php; do
    [ -f "$PROJECT_DIR/$file" ] || die "Neúplný zdrojový balík Core: chybí $file. Rozbalte celý full-source ZIP."
done
[ "$(id -u)" -eq 0 ] || die "Run this installer with: sudo sh install.sh"
chmod 755 "$0" 2>/dev/null || true
command -v docker >/dev/null 2>&1 || die "Docker was not found."
LOCK_DIR="$PROJECT_DIR/.hc-install-lock"
mkdir "$LOCK_DIR" 2>/dev/null || die "Another installation or an interrupted install lock exists: $LOCK_DIR"
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT HUP INT TERM
RUNTIME_ITEMS="appinfo css js lib"
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

# Před prvním occ odsunout staré duplicitní kopie mimo custom_apps.
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
DISTRIBUTED_CACHE="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ config:system:get memcache.distributed 2>/dev/null || true)"
if printf '%s' "$DISTRIBUTED_CACHE" | grep -qi 'redis'; then
 say "Map runtime counters: Nextcloud distributed Redis cache (automatic)"
else
 say "WARNING: Nextcloud distributed Redis cache is not configured; external map downloads require a working distributed cache; cached tiles remain available."
fi
DATA_DIRECTORY="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ config:system:get datadirectory)"
case "$DATA_DIRECTORY" in /*) ;; *) die "Cannot locate Nextcloud data directory for deployment backup.";; esac
TMP_LOCAL="$(mktemp -d)"
# Obnova kódu při jakékoli chybě po zahájení výměny, včetně chyby po app:enable.
. "$PROJECT_DIR/scripts/install-transaction.sh"
install_cleanup() {
 status=$?
 trap - EXIT HUP INT TERM
 if [ "$status" -ne 0 ]; then hc_tx_restore || true; fi
 hc_cleanup_install_stage
 rm -rf "$TMP_LOCAL"
 rmdir "$LOCK_DIR" 2>/dev/null || true
 exit "$status"
}
trap install_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
STAGE="$TMP_LOCAL/$APP_ID"; mkdir -p "$STAGE"
for item in $RUNTIME_ITEMS; do cp -R "$APP_DIR/$item" "$STAGE/"; done
TARGET_DIR="/var/www/html/custom_apps/$APP_ID"; BACKUP_DIR="${DATA_DIRECTORY}/hc-core-deployment-backups/${APP_ID}.$(date +%Y%m%d%H%M%S).$$"; REMOTE_TMP="/tmp/${APP_ID}.install.$$"
PREVIOUS_ENABLED=0
if docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:list --enabled 2>/dev/null | grep -q -- "- $APP_ID:"; then PREVIOUS_ENABLED=1; fi
hc_tx_begin "$WEB_CONTAINER" "$CRON_CONTAINER" "$APP_ID" "$TARGET_DIR" "$BACKUP_DIR" "$INSTALLED_VERSION" "$PREVIOUS_ENABLED"
docker exec "$WEB_CONTAINER" sh -c 'mkdir -p /var/www/html/custom_apps'
docker exec "$WEB_CONTAINER" rm -rf "$REMOTE_TMP" >/dev/null 2>&1 || true
docker exec "$WEB_CONTAINER" mkdir -p "$REMOTE_TMP"; docker cp "$STAGE/." "$WEB_CONTAINER:$REMOTE_TMP/"
docker exec "$WEB_CONTAINER" chown -R www-data:www-data "$REMOTE_TMP"
# Ověřit PHP v připravené kopii, dokud běží původní verze.
docker exec "$WEB_CONTAINER" sh -c 'find "$1" -type f -name "*.php" -exec php -l {} \;' sh "$REMOTE_TMP" >"$TMP_LOCAL/php-lint.log" 2>&1 || { cat "$TMP_LOCAL/php-lint.log"; die "Staged PHP validation failed."; }
if grep -q 'Errors parsing' "$TMP_LOCAL/php-lint.log"; then cat "$TMP_LOCAL/php-lint.log"; die "Staged PHP validation failed."; fi
# Test cache Core běží nad stagingem v /tmp ještě před výměnou kódu.
CACHE_TEST="$PROJECT_DIR/build/tests/php/cache.php"
[ -f "$CACHE_TEST" ] || die "Full-source package is missing build/tests/php/cache.php"
REMOTE_TEST="/tmp/${APP_ID}.cache-test.$$.php"
docker cp "$CACHE_TEST" "$WEB_CONTAINER:$REMOTE_TEST"
docker exec "$WEB_CONTAINER" chmod 644 "$REMOTE_TEST"
if ! docker exec -u www-data -e "HC_CORE_TEST_SOURCE=$REMOTE_TMP" "$WEB_CONTAINER" php "$REMOTE_TEST"; then
 docker exec "$WEB_CONTAINER" rm -f "$REMOTE_TEST"
 die "Native cache qualification failed before deployment; installed Core was not replaced."
fi
docker exec "$WEB_CONTAINER" rm -f "$REMOTE_TEST"
# Stará verze se ukládá mimo custom_apps; záloha se při obnově nemaže.
hc_tx_disable_web
hc_tx_backup_web
hc_tx_place_web "$REMOTE_TMP"
# Ověřit konkrétní nasazený soubor jako www-data ještě před prací s DB.
docker exec -u www-data "$WEB_CONTAINER" test -r "$TARGET_DIR/appinfo/info.xml" || die "Deployed Core info.xml is missing or unreadable: $TARGET_DIR/appinfo/info.xml"
DEPLOYED_VERSION="$(docker exec -u www-data "$WEB_CONTAINER" sh -c 'grep -o "<version>[^<]*</version>" "$1" | head -n 1 | sed "s#<version>##;s#</version>##"' sh "$TARGET_DIR/appinfo/info.xml")"
[ "$DEPLOYED_VERSION" = "$SOURCE_VERSION" ] || die "Version verification failed. Source: $SOURCE_VERSION, deployed: ${DEPLOYED_VERSION:-missing}"
# Zkušební soubor rozliší sdílený svazek od samostatné kopie pro cron.
PROBE_FILE=".hc-deploy-probe-$$"
docker exec "$WEB_CONTAINER" touch "$TARGET_DIR/$PROBE_FILE"
if [ -n "$CRON_CONTAINER" ] && [ "$CRON_CONTAINER" != "$WEB_CONTAINER" ]; then
 if docker exec "$CRON_CONTAINER" test -f "$TARGET_DIR/$PROBE_FILE"; then
  say "Cron sees the same deployed application tree."
 else
  CRON_TMP="/tmp/${APP_ID}.install.$$"
  docker exec "$CRON_CONTAINER" mkdir -p "$CRON_TMP"
  docker cp "$STAGE/." "$CRON_CONTAINER:$CRON_TMP/"
  hc_tx_backup_cron
  hc_tx_place_cron "$CRON_TMP"
 fi
fi
docker exec "$WEB_CONTAINER" rm -f "$TARGET_DIR/$PROBE_FILE"
docker exec "$WEB_CONTAINER" php -r 'if (function_exists("opcache_reset")) { opcache_reset(); }' >/dev/null 2>&1 || true
say "Checking application database structure..."
docker exec -i -u www-data "$WEB_CONTAINER" php -l < "$PROJECT_DIR/scripts/ensure-schema.php" >/dev/null || die "Invalid database check PHP syntax."
docker exec -i -u www-data "$WEB_CONTAINER" php < "$PROJECT_DIR/scripts/ensure-schema.php" || die "Could not complete the application database structure; original rows have not been deleted."
docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:enable "$APP_ID"
# Zapsat verzi jen této aplikace; struktura DB již byla ověřena.
CONFIG_VERSION_BEFORE="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ config:app:get "$APP_ID" installed_version 2>/dev/null || true)"
if [ "$CONFIG_VERSION_BEFORE" != "$SOURCE_VERSION" ]; then
 docker exec -u www-data "$WEB_CONTAINER" php -r 'require "/var/www/html/lib/base.php"; if (!\OC_App::updateApp($argv[1])) { throw new \RuntimeException("Application update failed"); }' "$APP_ID" || die "Targeted application update failed."
fi
CONFIG_VERSION="$(docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ config:app:get "$APP_ID" installed_version 2>/dev/null || true)"
[ "$CONFIG_VERSION" = "$SOURCE_VERSION" ] || die "Nextcloud app config version mismatch. Expected: $SOURCE_VERSION, reported: ${CONFIG_VERSION:-missing}"
docker exec -i -u www-data "$WEB_CONTAINER" php < "$PROJECT_DIR/build/tools/verify-core-install.php" || die "Core database verification failed; inspect the checks above."
# Samotné CLI opcache_reset neobnoví webové PHP. Šetrné obnovení Apache/FPM
# neukončí kontejner a načte nové třídy.
if docker exec "$WEB_CONTAINER" sh -c 'command -v apache2ctl >/dev/null 2>&1'; then
 docker exec "$WEB_CONTAINER" apache2ctl -k graceful >/dev/null 2>&1 || die "Apache reload failed; retained runtime backup must be reviewed."
 say "Web runtime refresh requested: Apache graceful reload"
elif docker exec "$WEB_CONTAINER" sh -c 'test -r /proc/1/comm && grep -qi php-fpm /proc/1/comm'; then
 docker exec "$WEB_CONTAINER" kill -USR2 1 >/dev/null 2>&1 || die "PHP-FPM reload failed."
 say "Web runtime refresh requested: PHP-FPM reload"
fi
sleep 2
docker exec -u www-data "$WEB_CONTAINER" test -r "$TARGET_DIR/appinfo/info.xml" || die "Deployed Core info.xml disappeared or became unreadable: $TARGET_DIR/appinfo/info.xml"
for item in $RUNTIME_ITEMS; do docker exec "$WEB_CONTAINER" sh -c "test -e '$TARGET_DIR/$item'" || die "Deployment verification failed. Missing: $TARGET_DIR/$item"; done
if [ "$APP_ID" != "$LEGACY_APP_ID" ] && docker exec "$WEB_CONTAINER" sh -c "test -d '/var/www/html/custom_apps/$LEGACY_APP_ID'"; then
 if docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:list --enabled 2>/dev/null | grep -q -- "- $LEGACY_APP_ID:"; then
  docker exec -u www-data "$WEB_CONTAINER" php /var/www/html/occ app:disable "$LEGACY_APP_ID"
 fi
 say "Legacy Core $LEGACY_APP_ID was disabled; its files and data were retained for recovery."
fi
say "$APP_NAME version: $DEPLOYED_VERSION"; say "Filesystem/installed-version verification: OK; browser startup and maps require runtime qualification."; say "$APP_NAME deployment finished successfully."
