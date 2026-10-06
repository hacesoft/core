<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

final class Application extends App implements IBootstrap {
    public const APP_ID = 'hc_shared_app_core';
    public const LEGACY_APP_ID = 'appcore';
    public const VERSION = '0.18.0-dev.16';
    public const API_VERSION = 1;
    public const NEXTCLOUD_MIN = 35;
    public const NEXTCLOUD_MAX = 35;

    public function __construct() {
        parent::__construct(self::APP_ID);
    }

    public function register(IRegistrationContext $context): void {
    }

    public function boot(IBootContext $context): void {
    }
}
