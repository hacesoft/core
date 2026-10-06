<?php

declare(strict_types=1);

namespace OCA\HcExampleApp\BackgroundJob;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\TimedJob;
use OCP\IConfig;

/** Small working example; replace the action with app-specific work. */
final class Heartbeat extends TimedJob {
    public function __construct(ITimeFactory $time, private IConfig $config) {
        parent::__construct($time);
        $this->setInterval(3600);
        $this->setAllowParallelRuns(false);
    }

    protected function run($argument): void {
        // No user content is read or changed. This timestamp proves the job ran.
        $this->config->setAppValue('hc_example_app', 'heartbeat_last_run', gmdate('c'));
    }
}
