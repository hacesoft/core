<?php
declare(strict_types=1);
namespace OCA\HcSharedAppCore\Service;

use OCP\IConfig;

/** Local shared data-volume cache. No Nextcloud filecache/appconfig writes on tile I/O.
 * 16 independently locked shards divide the global byte budget. Never hold a shard
 * lock during network I/O. A single atomic record contains metadata and image.
 */
final class MapTileStore {
    private const SHARDS = 16;
    private string $root;

    public function __construct(IConfig $config) {
        $data = rtrim((string)$config->getSystemValue('datadirectory', ''), '/');
        if ($data === '' || !is_dir($data)) throw new \RuntimeException('Core map cache data directory is unavailable.');
        $this->root = $data . '/hc_shared_app_core_maps_v2';
        $this->mkdir($this->root);
        $this->mkdir($this->root . '/locks');
    }

    private function mkdir(string $path): void {
        if (!is_dir($path) && !@mkdir($path, 0700, true) && !is_dir($path)) throw new \RuntimeException('Core map cache directory cannot be created.');
    }

    private function lock(string $name, int $mode, callable $callback, float $timeout = 14.0): mixed {
        $handle = @fopen($this->root . '/locks/' . $name . '.lock', 'c');
        if ($handle === false) throw new \RuntimeException('Core map cache lock is unavailable.');
        $deadline = microtime(true) + $timeout;
        try {
            while (!flock($handle, $mode | LOCK_NB)) {
                if (microtime(true) >= $deadline) throw new \RuntimeException('Core map cache is busy; retry the request.');
                usleep(25000);
            }
            try { return $callback(); } finally { flock($handle, LOCK_UN); }
        } finally { fclose($handle); }
    }

    /** Wait for the actual owner, never download without ownership. */
    public function withTile(string $hash, callable $callback): mixed {
        $this->validateHash($hash);
        return $this->lock('maintenance', LOCK_SH, fn() => $this->lock('tile-' . $hash, LOCK_EX, $callback));
    }

    private function validateHash(string $hash): void {
        if (!preg_match('/^[a-f0-9]{64}$/D', $hash)) throw new \InvalidArgumentException('Invalid cache hash.');
    }

    private function shard(string $hash): string {
        $this->validateHash($hash);
        $path = $this->root . '/' . $hash[0];
        $this->mkdir($path);
        return $path;
    }

    public function get(string $hash): ?array {
        $path = $this->shard($hash) . '/' . $hash . '.tile';
        $raw = @file_get_contents($path, false, null, 0, 4202501);
        if ($raw === false || strlen($raw) < 4 || strlen($raw) > 4202500) return null;
        $size = unpack('Nsize', substr($raw, 0, 4))['size'];
        if ($size > 8192 || strlen($raw) < 4 + $size) return null;
        try { $meta = json_decode(substr($raw, 4, $size), true, 32, JSON_THROW_ON_ERROR); }
        catch (\Throwable) { return null; }
        $body = substr($raw, 4 + $size);
        if (!is_array($meta) || !isset($meta['checksum'], $meta['mime'], $meta['freshUntil'], $meta['storedAt'], $meta['provider']) || !is_int($meta['freshUntil']) || !is_int($meta['storedAt']) || !hash_equals((string)$meta['checksum'], hash('sha256', $body))) return null;
        return ['content' => $body, ...$meta];
    }

    private function atomic(string $path, string $body): void {
        $tmp = tempnam(dirname($path), '.pending-');
        if ($tmp === false) throw new \RuntimeException('Core map cache cannot create a temporary file.');
        try {
            if (file_put_contents($tmp, $body) !== strlen($body) || !rename($tmp, $path)) throw new \RuntimeException('Core map cache write failed.');
        } finally { if (is_file($tmp)) @unlink($tmp); }
    }

    /** Caller owns maintenance SH + tile EX; this lock covers only local disk work. */
    public function put(string $hash, array $entry, int $limit): bool {
        $dir = $this->shard($hash);
        return $this->lock('shard-' . $hash[0], LOCK_EX, function () use ($hash, $dir, $entry, $limit): bool {
            $index = $this->index($dir);
            $content = $entry['content']; unset($entry['content']);
            $entry['checksum'] = hash('sha256', $content);
            $json = json_encode($entry, JSON_THROW_ON_ERROR);
            if (strlen($json) > 8192) throw new \RuntimeException('Core map cache metadata is too large.');
            $record = pack('N', strlen($json)) . $json . $content;
            $budget = intdiv(max(0, $limit), self::SHARDS);
            if (strlen($record) > $budget) return false;
            // Dirty marker survives interruption; next indexed operation rebuilds this shard.
            $this->atomic($dir . '/dirty', '1');
            if (isset($index[$hash])) unset($index[$hash]);
            $bytes = array_sum(array_column($index, 'bytes'));
            uasort($index, static fn($a, $b) => $a['storedAt'] <=> $b['storedAt']);
            foreach ($index as $oldHash => $old) {
                if ($bytes + strlen($record) <= $budget) break;
                if (!@unlink($dir . '/' . $oldHash . '.tile') && is_file($dir . '/' . $oldHash . '.tile')) throw new \RuntimeException('Core cache eviction failed.');
                $bytes -= $old['bytes']; unset($index[$oldHash]);
            }
            $this->atomic($dir . '/' . $hash . '.tile', $record);
            $index[$hash] = ['bytes' => strlen($record), 'storedAt' => $entry['storedAt'], 'freshUntil' => $entry['freshUntil'], 'provider' => $entry['provider']];
            $this->saveIndex($dir, $index);
            return true;
        });
    }

    private function saveIndex(string $dir, array $index): void {
        $this->atomic($dir . '/index.json', json_encode($index, JSON_THROW_ON_ERROR));
        @unlink($dir . '/dirty');
    }

    public function remove(string $hash): void {
        $dir = $this->shard($hash);
        $this->lock('shard-' . $hash[0], LOCK_EX, function () use ($dir, $hash): void {
            $index = $this->index($dir);
            $this->atomic($dir . '/dirty', '1');
            $path = $dir . '/' . $hash . '.tile';
            if (!@unlink($path) && is_file($path)) throw new \RuntimeException('Core cache removal failed.');
            unset($index[$hash]); $this->saveIndex($dir, $index);
        });
    }

    public function trim(int $limit): void {
        $this->lock('maintenance', LOCK_EX, function () use ($limit): void {
            foreach (str_split('0123456789abcdef') as $shard) {
                $dir = $this->root . '/' . $shard;
                if (!is_dir($dir)) continue;
                $index = $this->index($dir); $bytes = array_sum(array_column($index, 'bytes'));
                uasort($index, static fn($a, $b) => $a['storedAt'] <=> $b['storedAt']);
                $this->atomic($dir . '/dirty', '1');
                foreach ($index as $hash => $entry) {
                    if ($bytes <= intdiv($limit, self::SHARDS)) break;
                    $path = $dir . '/' . $hash . '.tile';
                    if (!@unlink($path) && is_file($path)) throw new \RuntimeException('Core cache eviction failed.');
                    $bytes -= $entry['bytes']; unset($index[$hash]);
                }
                $this->saveIndex($dir, $index);
            }
        }, 1.0);
    }

    /** Rebuild only missing/corrupt/interrupted indexes, never the regular statistics path. */
    private function index(string $dir): array {
        if (!file_exists($dir . '/dirty')) {
            $raw = @file_get_contents($dir . '/index.json');
            if ($raw !== false) {
                try { $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); if (is_array($data)) return $data; } catch (\Throwable) {}
            }
        }
        $index = [];
        foreach (glob($dir . '/*.tile') ?: [] as $path) {
            $hash = basename($path, '.tile'); $entry = $this->get($hash);
            if ($entry === null) { @unlink($path); continue; }
            $index[$hash] = ['bytes' => filesize($path), 'storedAt' => $entry['storedAt'], 'freshUntil' => $entry['freshUntil'], 'provider' => $entry['provider']];
        }
        foreach (glob($dir . '/.pending-*') ?: [] as $path) @unlink($path);
        $this->saveIndex($dir, $index);
        return $index;
    }

    public function statistics(int $limit): array {
        return $this->lock('maintenance', LOCK_SH, function () use ($limit): array {
            $bytes = 0; $count = 0; $oldest = null; $newest = null;
            foreach (str_split('0123456789abcdef') as $shard) {
                $dir = $this->root . '/' . $shard;
                if (!is_dir($dir)) continue;
                $index = $this->lock('shard-' . $shard, LOCK_EX, fn() => $this->index($dir));
                foreach ($index as $entry) { $bytes += $entry['bytes']; $count++; $oldest = $oldest === null ? $entry['storedAt'] : min($oldest, $entry['storedAt']); $newest = max($newest ?? 0, $entry['storedAt']); }
            }
            return ['bytes' => $bytes, 'limitBytes' => $limit, 'freeBytes' => max(0, $limit - $bytes), 'usagePercent' => $limit > 0 ? round(100 * $bytes / $limit, 2) : 0,
                'entryCount' => $count, 'oldestStoredAt' => $oldest === null ? null : gmdate('c', $oldest), 'newestStoredAt' => $newest === null ? null : gmdate('c', $newest), 'storage' => 'shared-filesystem-v2'];
        });
    }

    public function clear(string $mode, ?string $provider): array {
        return $this->lock('maintenance', LOCK_EX, function () use ($mode, $provider): array {
            $count = 0; $bytes = 0;
            foreach (str_split('0123456789abcdef') as $shard) {
                $dir = $this->root . '/' . $shard;
                if (!is_dir($dir)) continue;
                $index = $this->index($dir);
                $this->atomic($dir . '/dirty', '1');
                foreach ($index as $hash => $entry) {
                    if ($mode !== 'all' && !($mode === 'provider' && $entry['provider'] === $provider) && !($mode === 'expired' && $entry['freshUntil'] <= time())) continue;
                    $path = $dir . '/' . $hash . '.tile';
                    if (!@unlink($path) && is_file($path)) throw new \RuntimeException('Core cache clear failed.');
                    $bytes += $entry['bytes']; $count++; unset($index[$hash]);
                }
                $this->saveIndex($dir, $index);
            }
            return ['deletedEntries' => $count, 'deletedBytes' => $bytes];
        }, 1.0);
    }
}
