<?php

declare(strict_types=1);

namespace OCP\Lock {
    class LockedException extends \RuntimeException {}
    interface ILockingProvider {
        public const LOCK_EXCLUSIVE = 2;
        public function acquireLock(string $path, int $type): void;
        public function releaseLock(string $path, int $type): void;
    }
}

namespace {
    require __DIR__ . '/../../../src/lib/Service/MutationLock.php';

    use OCA\HcSharedAppCore\Service\MutationLock;
    use OCP\Lock\ILockingProvider;

    $provider = new class implements ILockingProvider {
        public array $locked = [];
        public array $history = [];
        public bool $reject = false;
        public function acquireLock(string $path, int $type): void {
            if ($this->reject || isset($this->locked[$path])) throw new \OCP\Lock\LockedException('Lock unavailable');
            if ($type !== self::LOCK_EXCLUSIVE) throw new \RuntimeException('Not an exclusive lock');
            $this->locked[$path] = true;
            $this->history[] = ['acquire', $path];
        }
        public function releaseLock(string $path, int $type): void {
            if (!isset($this->locked[$path])) throw new \RuntimeException('Unexpected unlock');
            unset($this->locked[$path]);
            $this->history[] = ['release', $path];
        }
    };
    $guard = new MutationLock($provider);
    $called = 0;
    $value = $guard->synchronized('lists:map_places', 'alice', function () use (&$called): int {
        $called++;
        return 42;
    });
    if ($value !== 42 || $called !== 1 || $provider->locked !== []) throw new \RuntimeException('Normal operation failed');

    try {
        $guard->synchronized('lists:map_places', 'alice', static function (): never { throw new \DomainException('test'); });
        throw new \RuntimeException('Expected operation failure');
    } catch (\DomainException $expected) {}
    if ($provider->locked !== []) throw new \RuntimeException('Lock leaked after exception');

    $provider->reject = true;
    try {
        $guard->synchronized('lists:map_places', 'alice', function () use (&$called): void { $called++; });
        throw new \RuntimeException('Expected lock failure');
    } catch (\RuntimeException $expected) {
        if ($expected->getCode() !== 409) throw $expected;
    }
    if ($called !== 1) throw new \RuntimeException('Operation executed without a lock');
    $provider->reject = false;

    $guard->synchronized('lists:map_places', 'alice', static function (): void {});
    $guard->synchronized('lists:map_places', 'bob', static function (): void {});
    $guard->synchronized('map:favorites', 'alice', static function (): void {});
    $paths = array_map(static fn ($row) => $row[1], array_filter($provider->history, static fn ($row) => $row[0] === 'acquire'));
    if ($paths[0] !== $paths[2]) throw new \RuntimeException('Unstable resource lock key');
    if (count(array_unique($paths)) !== 3) throw new \RuntimeException('Different lock scopes collide');
    echo "PASS mutation lock release/failure/resource scope (isolated provider double)\n";
}
