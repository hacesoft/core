<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Service;

use OCP\Lock\ILockingProvider;
use OCP\Lock\LockedException;

/** Serializes mutations sharing the same logical owner and resource. */
final class MutationLock {
    public function __construct(private ILockingProvider $provider) {}

    public function synchronized(string $scope, string $owner, callable $operation): mixed {
        // Hash arbitrary user IDs to keep lock paths bounded and unambiguous.
        $key = 'hc_shared_app_core:mutation:' . hash('sha256', $scope . "\0" . $owner);
        // Nextcloud locks do not wait. Retry briefly and report an explicit
        // conflict rather than letting a failed acquisition turn into HTTP 500.
        for ($attempt = 0; ; $attempt++) {
            try {
                $this->provider->acquireLock($key, ILockingProvider::LOCK_EXCLUSIVE);
                break;
            } catch (LockedException $e) {
                if ($attempt >= 3) {
                    throw new \RuntimeException('Another edit is in progress. Please retry.', 409, $e);
                }
                usleep(25000 * ($attempt + 1));
            }
        }
        try {
            return $operation();
        } finally {
            $this->provider->releaseLock($key, ILockingProvider::LOCK_EXCLUSIVE);
        }
    }
}
