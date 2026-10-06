<?php

declare(strict_types=1);

// Read-only database verification after deploying Shared App Core on the NAS.
// The installer checks the deployed info.xml separately, before this script runs.
// sudo docker exec -i -u www-data nextcloud-app php < build/tools/verify-core-install.php
require '/var/www/html/lib/base.php';

$appId = 'hc_shared_app_core';
$installedVersion = \OC::$server->get(\OCP\IConfig::class)->getAppValue($appId, 'installed_version', '');
$db = \OC::$server->get(\OCP\IDBConnection::class);
$ok = $installedVersion !== '';
echo 'Core installed_version: ' . ($installedVersion ?: 'missing') . PHP_EOL;

foreach (['hc_core_lists', 'hc_core_places', 'hc_core_list_acl', 'hc_core_place_acl'] as $table) {
    $exists = $db->tableExists($table);
    echo $table . ': ' . ($exists ? 'OK' : 'MISSING') . PHP_EOL;
    $ok = $ok && $exists;
}
if ($db->tableExists('hc_core_lists')) {
    try {
        $db->executeQuery('SELECT parent_id, icon FROM *PREFIX*hc_core_lists WHERE 1 = 0');
        echo 'hc_core_lists.parent_id + icon: OK' . PHP_EOL;
    } catch (\Throwable $e) {
        echo 'hc_core_lists.parent_id + icon: MISSING (' . $e->getMessage() . ')' . PHP_EOL;
        $ok = false;
    }
}
exit($ok ? 0 : 1);
