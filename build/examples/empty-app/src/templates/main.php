<?php

declare(strict_types=1);

use OCP\Util;

// Nextcloud zajistí deterministické pořadí: Core styly, aplikace, Core JS, aplikace JS.
Util::addStyle('hc_shared_app_core', 'workspace');
Util::addStyle('hc_example_app', 'main');
Util::addScript('hc_shared_app_core', 'hc_shared_app_core');
Util::addScript('hc_example_app', 'main');
?>
<div
    id="hc_example_app"
    data-app-version="<?php p($_['appVersion']); ?>"
    data-required-core-version="<?php p($_['requiredCoreVersion']); ?>"
    data-required-core-api-version="<?php p($_['requiredCoreApiVersion']); ?>"
    data-core-download-url="<?php p($_['coreDownloadUrl']); ?>"
></div>
