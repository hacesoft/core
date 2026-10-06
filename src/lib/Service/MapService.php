<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Service;

use OCA\HcSharedAppCore\AppInfo\Application;
use OCP\Files\IAppData;
use OCP\Http\Client\IClientService;
use OCP\ICache;
use OCP\ICacheFactory;
use OCP\IConfig;
use OCP\Lock\ILockingProvider;
use OCP\Security\ICrypto;

final class MapService {
    private const DEFAULT_BROWSER_TTL = 604800;
    private const DEFAULT_TILE_TTL = 31536000;
    private const DEFAULT_MAX_CACHE_BYTES = 536870912;
    private const MAX_CACHE_BYTES = 5368709120;
    // Qualified on the target NAS with rapid pan/zoom on a large viewport.
    private const DEFAULT_TILE_REQUESTS_PER_MINUTE = 10000;
    private const DEFAULT_EXTERNAL_REQUESTS_PER_MINUTE = 5000;

    private readonly ICache $runtimeCache;

    public function __construct(
        private readonly IAppData $appData,
        private readonly IClientService $clientService,
        private readonly IConfig $config,
        ICacheFactory $cacheFactory,
        private readonly ILockingProvider $lockingProvider,
        private readonly ICrypto $crypto,
        private readonly MapProviderRegistry $providers,
        private readonly MapTileStore $tileStore,
    ) {
        // Nextcloud resolves this to Redis when memcache.distributed is configured.
        // Only short-lived counters live here; tile payloads use the shared filesystem store.
        $this->runtimeCache = $cacheFactory->createDistributed(Application::APP_ID . ':maps');
    }

    public function providers(): array {
        $result = [];
        foreach ($this->providers->list() as $provider) {
            $id = (string)$provider['id'];
            $provider['enabled'] = $this->isProviderEnabled($id);
            $provider['configured'] = !$provider['requiresApiKey'] || $this->activeKey($id) !== null;
            $result[] = $provider;
        }
        return $result;
    }

    public function tile(string $provider, string $mapset, int $tileSize, int $z, int $x, int $y): array {
        $this->providers->validateTile($provider, $mapset, $tileSize, $z, $x, $y);
        $allowed = $this->config->getAppValue(Application::APP_ID, "maps:provider:$provider:allowed-mapsets-v2", '__legacy__');
        if ($allowed === '__legacy__') {
            $allowed = $this->config->getAppValue(Application::APP_ID, "maps:provider:$provider:allowed-mapsets", '*');
            if ($allowed === '') $allowed = '*'; // Previous releases interpreted an empty list as unrestricted.
        }
        if ($allowed !== '*' && !in_array($mapset, explode(',', $allowed), true)) throw new \InvalidArgumentException('This mapset is disabled by the administrator.');
        if (!$this->isProviderEnabled($provider)) throw new \RuntimeException('The map provider is temporarily disabled.');
        $cacheKey = sprintf('maps:tile:%s:%s:%d:%d:%d:%d', $provider, $mapset, $tileSize, $z, $x, $y);
        $hash = hash('sha256', $cacheKey);
        $this->increment('requests');
        $cached = $this->tileStore->get($hash);
        if ($cached !== null && $cached['freshUntil'] > time()) {
            $this->increment('hits');
            return $this->tileResult($cached, 'hit', $provider, $mapset, $z, $x, $y);
        }
        $this->increment('misses');
        try {
            return $this->tileStore->withTile($hash, function () use ($hash, $cacheKey, $provider, $mapset, $tileSize, $z, $x, $y): array {
                $entry = $this->tileStore->get($hash);
                if ($entry !== null && $entry['freshUntil'] > time()) {
                    $this->increment('misses', -1); $this->increment('hits'); $this->increment('deduplicated');
                    return $this->tileResult($entry, 'deduplicated', $provider, $mapset, $z, $x, $y);
                }
                // Read-only lazy legacy migration. Existing cache is not deleted on upgrade.
                if ($entry === null && !$this->legacyDisabled()) {
                    $entry = $this->readLegacy($hash, $provider);
                    if ($entry !== null) {
                        $this->tryStore($hash, $entry);
                        if ($entry['freshUntil'] > time()) { $this->increment('misses', -1); $this->increment('hits'); return $this->tileResult($entry, 'legacy-hit', $provider, $mapset, $z, $x, $y); }
                    }
                }
                try {
                    $this->consumeRate('tile', (int)$this->config->getAppValue(Application::APP_ID, 'maps:tile-rpm', (string)self::DEFAULT_TILE_REQUESTS_PER_MINUTE));
                    $this->consumeRate('external', (int)$this->config->getAppValue(Application::APP_ID, 'maps:external-rpm', (string)self::DEFAULT_EXTERNAL_REQUESTS_PER_MINUTE));
                    $url = $this->providers->tileUrl($provider, $mapset, $tileSize, $z, $x, $y, $this->activeKey($provider));
                    $headers = ['Accept' => 'image/png,image/jpeg,image/webp', 'User-Agent' => 'HC-Shared-App-Core/' . Application::VERSION . ' (+https://github.com/hacesoft/hc-shared-app-core)'];
                    if (!empty($entry['etag'])) $headers['If-None-Match'] = $entry['etag'];
                    if (!empty($entry['lastModified'])) $headers['If-Modified-Since'] = $entry['lastModified'];
                    $this->increment('external');
                    $response = $this->clientService->newClient()->get($url, ['timeout' => 12, 'connect_timeout' => 5, 'allow_redirects' => false, 'headers' => $headers]);
                    $status = $response->getStatusCode();
                    if ($status === 304 && $entry !== null) {
                        $next = $entry;
                        $this->increment('revalidated');
                    } else {
                        $content = (string)$response->getBody();
                        $mime = $this->imageMime($content);
                        if ($status < 200 || $status >= 300 || $mime === null) throw new \RuntimeException('The provider returned an invalid tile response.');
                        $next = ['content' => $content, 'mime' => $mime, 'provider' => $provider];
                    }
                    $control = (string)$response->getHeader('Cache-Control');
                    $expires = (string)$response->getHeader('Expires');
                    if ($status === 304 && $control === '' && $expires === '') $control = (string)($entry['cacheControl'] ?? 'no-cache');
                    $policy = MapCachePolicy::fromHeaders($control, $expires, (string)$response->getHeader('Age'), $this->tileTtl());
                    $next['storedAt'] = time(); $next['freshUntil'] = time() + $policy['ttl'];
                    $next['cacheControl'] = $control;
                    $next['etag'] = (string)$response->getHeader('ETag') ?: ($status === 304 ? ($entry['etag'] ?? '') : '');
                    $next['lastModified'] = (string)$response->getHeader('Last-Modified') ?: ($status === 304 ? ($entry['lastModified'] ?? '') : '');
                    $next['allowStale'] = $policy['allowStale'];
                    $this->increment('externalSuccess');
                    if ($policy['store']) $this->tryStore($hash, $next);
                    else { $this->tileStore->remove($hash); $next['freshUntil'] = time(); }
                    return $this->tileResult($next, $status === 304 ? 'revalidated' : 'miss', $provider, $mapset, $z, $x, $y);
                } catch (\Throwable $exception) {
                    $this->increment('errors');
                    $reason = $exception instanceof MapRequestException ? $exception->reason : 'provider_unavailable';
                    $this->increment($reason);
                    $this->rememberError($reason);
                    if ($entry !== null && ($entry['allowStale'] ?? false) && time() < $entry['freshUntil'] + 86400) {
                        $this->increment('fallbacks');
                        return $this->tileResult($entry, 'stale', $provider, $mapset, $z, $x, $y);
                    }
                    // Never expose a client exception containing an API key / request URL.
                    if ($exception instanceof MapRequestException) throw $exception;
                    throw new MapRequestException('provider_unavailable', 503, 5);
                }
            });
        } catch (\Throwable $exception) {
            if ($cached !== null && ($cached['allowStale'] ?? false) && time() < $cached['freshUntil'] + 86400) { $this->increment('fallbacks'); return $this->tileResult($cached, 'stale', $provider, $mapset, $z, $x, $y); }
            throw $exception;
        }
    }

    private function imageMime(string $content): ?string {
        if (strlen($content) > 4194304) return null;
        $info = @getimagesizefromstring($content);
        $mime = is_array($info) ? ($info['mime'] ?? '') : '';
        return in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true) ? $mime : null;
    }

    private function tryStore(string $hash, array $entry): void {
        try { if (!$this->tileStore->put($hash, $entry, $this->cacheLimit())) $this->increment('uncached'); }
        catch (\Throwable) { $this->increment('cacheWriteErrors'); $this->rememberError('Cache write failed; valid provider image was served without caching.'); }
    }

    private function rememberError(string $message): void {
        try { $this->runtimeCache->set('last-error-v3', gmdate('c') . ' ' . $message, 86400); } catch (\Throwable) {}
    }

    public function diagnostics(): array {
        $cache = $this->tileStore->statistics($this->cacheLimit());
        $runtime = $this->runtimeStatus();
        $hits = $runtime['available'] ? $this->counter('hits') : null;
        $deduplicated = $runtime['available'] ? $this->counter('deduplicated') : null;
        return [
            'runtimeCache' => $runtime,
            'tileStorage' => 'shared-filesystem-v2',
            'legacyCacheRetained' => !$this->legacyDisabled(),
            'externalSuccess' => $this->counter('externalSuccess'),
            'errors' => $this->counter('errors'),
            'cacheWriteErrors' => $this->counter('cacheWriteErrors'),
            'revalidatedRequests' => $this->counter('revalidated'),
            'requests' => $this->counter('requests'),
            'cacheHits' => $hits,
            'cacheMisses' => $this->counter('misses'),
            'externalRequests' => $this->counter('external'),
            'deduplicatedRequests' => $deduplicated,
            'fallbackResponses' => $this->counter('fallbacks'),
            'savedExternalRequests' => $hits,
            'rateLimitedRequests' => $this->counter('rate_limit_external') + $this->counter('rate_limit_tile'),
            'limiterUnavailableRequests' => $this->counter('limiter_unavailable'),
            'providerErrors' => $this->counter('provider_unavailable'),
            'cacheBytes' => $cache['bytes'],
            'cacheLimitBytes' => $cache['limitBytes'],
            'cacheFreeBytes' => $cache['freeBytes'],
            'cacheUsagePercent' => $cache['usagePercent'],
            'cacheEntryCount' => $cache['entryCount'],
            'cacheOldestStoredAt' => $cache['oldestStoredAt'],
            'cacheNewestStoredAt' => $cache['newestStoredAt'],
            'tileCacheTtlSeconds' => $this->tileTtl(),
            'browserCacheTtlSeconds' => $this->browserTtl(),
            'defaultProvider' => $this->config->getAppValue(Application::APP_ID, 'maps:default-provider', 'osm'),
            'tileRequestsPerMinute' => (int)$this->config->getAppValue(Application::APP_ID, 'maps:tile-rpm', (string)self::DEFAULT_TILE_REQUESTS_PER_MINUTE),
            'externalRequestsPerMinute' => (int)$this->config->getAppValue(Application::APP_ID, 'maps:external-rpm', (string)self::DEFAULT_EXTERNAL_REQUESTS_PER_MINUTE),
            'lastProviderError' => $this->lastError(),
            'providers' => $this->providers(),
        ];
    }

    public function offerKey(string $provider, string $sourceApp, string $key, bool $activate = true): array {
        $definition = $this->providers->get($provider);
        if (!$definition['requiresApiKey']) {
            throw new \InvalidArgumentException('This provider does not use an API key.');
        }
        if (!preg_match('/^hc_[a-z0-9_]{2,60}$/', $sourceApp) || strlen($key) < 8 || strlen($key) > 512) {
            throw new \InvalidArgumentException('Invalid provider key registration.');
        }
        $fingerprint = substr(hash('sha256', $key), 0, 16);
        $active = $this->activeKey($provider);
        if ($active !== null && hash_equals(substr(hash('sha256', $active), 0, 16), $fingerprint)) {
            return $this->keyStatus($provider, 'unchanged');
        }
        $this->validateKey($provider, $key);
        $this->config->setAppValue(Application::APP_ID, "maps:key:$provider:candidate", $this->crypto->encrypt($key));
        $this->config->setAppValue(Application::APP_ID, "maps:key:$provider:candidate-fingerprint", $fingerprint);
        $this->config->setAppValue(Application::APP_ID, "maps:key:$provider:candidate-source", $sourceApp);
        $this->config->setAppValue(Application::APP_ID, "maps:key:$provider:candidate-validated-at", gmdate('c'));
        if ($activate || $active === null) {
            $this->activateCandidate($provider);
            return $this->keyStatus($provider, 'activated');
        }
        return $this->keyStatus($provider, 'validated');
    }

    public function activateCandidate(string $provider): void {
        $candidateEncrypted = $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:candidate", '');
        if ($candidateEncrypted === '') {
            throw new \RuntimeException('No validated candidate key is available.');
        }
        foreach (['candidate' => 'active', 'candidate-fingerprint' => 'active-fingerprint', 'candidate-source' => 'active-source', 'candidate-validated-at' => 'active-validated-at'] as $from => $to) {
            $value = $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:$from", '');
            $this->config->setAppValue(Application::APP_ID, "maps:key:$provider:$to", $value);
        }
    }

    public function setProviderEnabled(string $provider, bool $enabled): array {
        $this->providers->get($provider);
        $this->config->setAppValue(Application::APP_ID, "maps:provider:$provider:enabled", $enabled ? '1' : '0');
        return ['provider' => $provider, 'enabled' => $enabled];
    }

    public function configure(string $defaultProvider, int $cacheLimitBytes, int $tileCacheTtlDays, int $browserCacheTtlDays, int $tileRequestsPerMinute, int $externalRequestsPerMinute, array $allowedMapsets = []): array {
        $this->providers->get($defaultProvider);
        if ($cacheLimitBytes < 104857600 || $cacheLimitBytes > self::MAX_CACHE_BYTES
            || $tileCacheTtlDays < 1 || $tileCacheTtlDays > 3650
            || $browserCacheTtlDays < 1 || $browserCacheTtlDays > 365
            || $tileRequestsPerMinute < 60 || $tileRequestsPerMinute > 10000
            || $externalRequestsPerMinute < 10 || $externalRequestsPerMinute > 5000) {
            throw new \InvalidArgumentException('Map service limits are outside the supported range.');
        }
        foreach ($allowedMapsets as $provider => $mapsets) {
            $definition = $this->providers->get((string)$provider);
            if (!is_array($mapsets) || array_diff($mapsets, $definition['mapsets']) !== []) {
                throw new \InvalidArgumentException('Invalid allowed mapsets configuration.');
            }
            $this->config->setAppValue(Application::APP_ID, "maps:provider:$provider:allowed-mapsets-v2", implode(',', $mapsets));
        }
        $this->config->setAppValue(Application::APP_ID, 'maps:default-provider', $defaultProvider);
        $this->config->setAppValue(Application::APP_ID, 'maps:cache-limit-bytes', (string)$cacheLimitBytes);
        $this->config->setAppValue(Application::APP_ID, 'maps:tile-ttl-seconds', (string)($tileCacheTtlDays * 86400));
        $this->config->setAppValue(Application::APP_ID, 'maps:browser-ttl-seconds', (string)($browserCacheTtlDays * 86400));
        $this->config->setAppValue(Application::APP_ID, 'maps:tile-rpm', (string)$tileRequestsPerMinute);
        $this->config->setAppValue(Application::APP_ID, 'maps:external-rpm', (string)$externalRequestsPerMinute);
        $this->tileStore->trim($cacheLimitBytes);
        return $this->diagnostics();
    }

    public function clearCache(string $mode, ?string $provider, bool $confirm): array {
        if (!in_array($mode, ['expired', 'provider', 'all'], true)) {
            throw new \InvalidArgumentException('Unsupported cache clear mode.');
        }
        if ($mode === 'provider') {
            if ($provider === null || $provider === '') throw new \InvalidArgumentException('Provider is required for provider cache clear.');
            $this->providers->get($provider);
        }
        if ($mode === 'all' && !$confirm) {
            throw new \InvalidArgumentException('Explicit confirmation is required to clear the complete map cache.');
        }

        // Disable legacy resurrection before any explicit purge. Legacy bytes remain
        // as an upgrade backup and are not included in the v2 cache byte budget.
        $this->config->setAppValue(Application::APP_ID, 'maps:legacy-cache-disabled', '1');
        $cleared = $this->tileStore->clear($mode, $provider);
        if ($mode === 'all') {
            try { $legacy = $this->appData->getFolder('map-tiles'); }
            catch (\OCP\Files\NotFoundException) { $legacy = null; }
            if ($legacy !== null) $legacy->delete();
        }
        return ['mode' => $mode, 'provider' => $provider, ...$cleared, 'cache' => $this->tileStore->statistics($this->cacheLimit())];
    }

    private function validateKey(string $provider, string $key): void {
        $url = $this->providers->tileUrl($provider, 'basic', 256, 0, 0, 0, $key);
        $response = $this->clientService->newClient()->get($url, ['timeout' => 10, 'connect_timeout' => 5, 'headers' => ['Accept' => 'image/*']]);
        $mime = strtolower(trim(explode(';', (string)$response->getHeader('Content-Type'))[0]));
        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300 || !str_starts_with($mime, 'image/')) {
            throw new \RuntimeException('The provider rejected the offered API key.');
        }
    }

    private function activeKey(string $provider): ?string {
        $encrypted = $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:active", '');
        if ($encrypted === '') return null;
        try { return $this->crypto->decrypt($encrypted); } catch (\Throwable) { return null; }
    }

    private function keyStatus(string $provider, string $result): array {
        return [
            'provider' => $provider,
            'result' => $result,
            'activeKeyFingerprint' => $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:active-fingerprint", ''),
            'activeKeySourceApp' => $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:active-source", ''),
            'activeKeyValidatedAt' => $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:active-validated-at", ''),
            'candidateKeyFingerprint' => $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:candidate-fingerprint", ''),
            'candidateKeySourceApp' => $this->config->getAppValue(Application::APP_ID, "maps:key:$provider:candidate-source", ''),
        ];
    }

    private function isProviderEnabled(string $provider): bool {
        return $this->config->getAppValue(Application::APP_ID, "maps:provider:$provider:enabled", '1') === '1';
    }

    private function legacyDisabled(): bool { return $this->config->getAppValue(Application::APP_ID, 'maps:legacy-cache-disabled', '0') === '1'; }
    private function cacheLimit(): int { return (int)$this->config->getAppValue(Application::APP_ID, 'maps:cache-limit-bytes', (string)self::DEFAULT_MAX_CACHE_BYTES); }

    private function readLegacy(string $hash, string $provider): ?array {
        try {
            $folder = $this->appData->getFolder('map-tiles');
            $meta = json_decode($folder->getFile($hash . '.json')->getContent(), true, 32, JSON_THROW_ON_ERROR);
            $content = $folder->getFile($hash . '.bin')->getContent();
            $mime = $this->imageMime($content);
            if ($mime === null || !is_array($meta)) return null;
            // Legacy entries had no upstream policy. Revalidate after at most seven days.
            $storedAt = (int)($meta['storedAt'] ?? 0);
            return ['content' => $content, 'mime' => $mime, 'provider' => $provider, 'storedAt' => $storedAt,
                'freshUntil' => $storedAt + min(604800, $this->tileTtl()), 'allowStale' => false];
        } catch (\Throwable) { return null; }
    }

    private function consumeRate(string $bucket, int $limit): void {
        if (!str_contains(strtolower(get_class($this->runtimeCache)), 'redis')) throw new MapRequestException('limiter_unavailable', 503, 5);
        $now = time();
        $key = 'rate:v2:' . $bucket . ':' . gmdate('YmdHi', $now);
        try {
            $this->runtimeCache->add($key, 0, 120);
            $count = $this->runtimeCache->inc($key);
            if (!is_int($count) || $count < 1) throw new \RuntimeException('Atomic shared counter unavailable.');
        } catch (\Throwable) { throw new MapRequestException('limiter_unavailable', 503, 5); }
        if ($count > $limit) throw new MapRequestException('rate_limit_' . $bucket, 429, max(1, 60 - ($now % 60) - (time() - $now)));
    }

    private function increment(string $name, int $delta = 1): void {
        $key = 'stats:v3:' . gmdate('Ymd') . ':' . $name;
        try { $this->runtimeCache->add($key, 0, 172800); $delta < 0 ? $this->runtimeCache->dec($key, -$delta) : $this->runtimeCache->inc($key, $delta); } catch (\Throwable) {}
    }

    private function counter(string $name): ?int {
        if (!str_contains(strtolower(get_class($this->runtimeCache)), 'redis')) return null;
        try { $value = $this->runtimeCache->get('stats:v3:' . gmdate('Ymd') . ':' . $name); return $value === null ? 0 : (is_numeric($value) ? (int)$value : null); }
        catch (\Throwable) { return null; }
    }

    private function lastError(): string {
        try { return (string)($this->runtimeCache->get('last-error-v3') ?? ''); } catch (\Throwable) { return 'Shared counters unavailable; cached tiles can still be served.'; }
    }

    public function runtimeStatus(): array {
        $class = get_class($this->runtimeCache);
        $configured = str_contains(strtolower($class), 'redis');
        $available = false;
        try {
            $key = 'health:' . bin2hex(random_bytes(8));
            $this->runtimeCache->add($key, 0, 10);
            $available = $configured && $this->runtimeCache->inc($key) === 1;
            $this->runtimeCache->remove($key);
        } catch (\Throwable) {}
        return ['backend' => $configured ? 'redis' : 'other', 'available' => $available,
            'externalRequestsAllowed' => $available, 'tileStorage' => 'shared-filesystem-v2'];
    }

    private function tileTtl(): int {
        return (int)$this->config->getAppValue(Application::APP_ID, 'maps:tile-ttl-seconds', (string)self::DEFAULT_TILE_TTL);
    }

    private function browserTtl(): int {
        return (int)$this->config->getAppValue(Application::APP_ID, 'maps:browser-ttl-seconds', (string)self::DEFAULT_BROWSER_TTL);
    }

    private function tileResult(array $entry, string $cache, string $provider, string $mapset, int $z, int $x, int $y): array {
        $ttl = $cache === 'stale' ? 0 : min($this->browserTtl(), max(0, (int)$entry['freshUntil'] - time()));
        return ['content' => $entry['content'], 'mime' => $entry['mime'], 'headers' => [
            'Cache-Control' => $ttl > 0 ? 'private, max-age=' . $ttl : 'private, no-store',
            'X-HC-Core-Map-Cache' => $cache, 'X-HC-Core-Map-Provider' => $provider,
            'X-HC-Core-Mapset' => $mapset, 'X-HC-Core-Tile' => "$z/$x/$y",
        ]];
    }
}
