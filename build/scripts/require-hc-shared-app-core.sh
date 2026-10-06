#!/usr/bin/env bash
set -euo pipefail

required_version="${1:?Použití: require-hc-shared-app-core.sh MINIMALNI_VERZE}"
container_name="${NEXTCLOUD_CONTAINER:-nextcloud-app}"

current_version="$(docker exec --user www-data "${container_name}" php /var/www/html/occ app:list --enabled --output=json \
  | docker exec -i --user www-data "${container_name}" php -r '
      $data = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
      $enabled = $data["enabled"] ?? [];
      if (!array_key_exists("hc_shared_app_core", $enabled)) exit(2);
      echo $enabled["hc_shared_app_core"];
    ')" || {
      echo "CHYBA: Shared App Core není nainstalováno a povoleno." >&2
      exit 1
    }

if ! docker exec --user www-data "${container_name}" php -r 'exit(version_compare($argv[1], $argv[2], ">=") ? 0 : 1);' \
  "${current_version}" "${required_version}"; then
  echo "CHYBA: Vyžadováno hc_shared_app_core >= ${required_version}, nalezeno ${current_version}." >&2
  exit 1
fi

echo "OK: hc_shared_app_core ${current_version} splňuje minimum ${required_version}."
