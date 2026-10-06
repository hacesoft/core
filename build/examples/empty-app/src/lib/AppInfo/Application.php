<?php

declare(strict_types=1);

namespace OCA\HcExampleApp\AppInfo;

use OCP\AppFramework\App;

final class Application extends App {
    public const APP_ID = 'hc_example_app';
    public const VERSION = '1.0.0';

    public function __construct() {
        parent::__construct(self::APP_ID);
    }
}
