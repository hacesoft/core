#!/bin/sh
# Read host versions and run isolated PHP tests. No install, upgrade or real cache writes.
set -eu
CONTAINER="${1:?Usage: sh qualify-container.sh CONTAINER NC_MAJOR PHP_MINOR}"
EXPECTED_NC="${2:?Expected NC major 35}"
EXPECTED_PHP="${3:-8.5}"
case "$EXPECTED_NC" in 35) ;; *) echo 'Expected NC must be 35 for this Core candidate' >&2; exit 1;; esac
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
docker exec "$CONTAINER" php -r 'if (PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION !== $argv[1]) {fwrite(STDERR,"Unexpected PHP version\n");exit(1);} echo "PHP ".PHP_VERSION."\n";' "$EXPECTED_PHP"
docker exec -u www-data "$CONTAINER" php /var/www/html/occ status --output=json | docker exec -i "$CONTAINER" php -r '$s=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);if(empty($s["installed"]) || !empty($s["maintenance"]) || !empty($s["needsDbUpgrade"]) || (int)explode(".",$s["version"])[0] !== (int)$argv[1]) {fwrite(STDERR,"Nextcloud not ready or unexpected version\n");exit(1);}echo "Nextcloud ".$s["version"]."\n";' "$EXPECTED_NC"
STAGE="$(docker exec "$CONTAINER" mktemp -d /tmp/hc-core-qualification.XXXXXXXX)"
case "$STAGE" in /tmp/hc-core-qualification.*) ;; *) exit 1;; esac
trap 'docker exec "$CONTAINER" rm -rf -- "$STAGE" >/dev/null 2>&1 || true' EXIT HUP INT TERM
docker cp "$ROOT/src" "$CONTAINER:$STAGE/src" >/dev/null
docker cp "$ROOT/build/tests/php/cache.php" "$CONTAINER:$STAGE/cache.php" >/dev/null
docker exec "$CONTAINER" chmod -R a+rX "$STAGE"
docker exec "$CONTAINER" php -r '$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($argv[1],FilesystemIterator::SKIP_DOTS));foreach($it as $f){if($f->getExtension()!=="php")continue;passthru(escapeshellarg(PHP_BINARY)." -l ".escapeshellarg($f->getPathname()),$status);if($status!==0)exit($status);}' "$STAGE/src"
docker exec -u www-data -e "HC_CORE_TEST_SOURCE=$STAGE/src" "$CONTAINER" php "$STAGE/cache.php"
echo 'Isolated PHP checks PASS. HTTP, Redis, provider and UI qualification are still required.'
