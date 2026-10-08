<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Controller;

use OCA\HcSharedAppCore\AppInfo\Application;
use OCA\HcSharedAppCore\Service\GitHubReleaseResolver;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IConfig;
use OCP\IUserSession;
use OCP\IUserManager;
use OCP\IGroupManager;
use OCP\Http\Client\IClientService;

final class ApiController extends Controller {
    public function __construct(
        IRequest $request,
        private IConfig $config,
        private IUserSession $userSession,
        private IUserManager $userManager,
        private IGroupManager $groupManager,
        private IClientService $clientService,
    ) {
        parent::__construct(Application::APP_ID, $request);
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function status(): JSONResponse {
        $sInstalledVersion = $this->config->getAppValue(Application::APP_ID, 'installed_version', Application::VERSION);
        $oResponse = new JSONResponse([
            'app' => Application::APP_ID,
            'version' => Application::VERSION,
            'installedVersion' => $sInstalledVersion,
            'apiVersion' => Application::API_VERSION,
            'nextcloud' => ['min' => Application::NEXTCLOUD_MIN, 'max' => Application::NEXTCLOUD_MAX],
            'repository' => 'https://github.com/hacesoft/core',
            'downloadUrl' => 'https://github.com/hacesoft/core/releases',
            'contract' => 'hc-shared-app-core-v1',
            'qualification' => 'pending-nc35-runtime',
        ]);
        $oResponse->addHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $oResponse->addHeader('Pragma', 'no-cache');
        $oResponse->addHeader('Expires', '0');
        return $oResponse;
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function release(string $repository, bool $refresh = false, string $appId = ''): JSONResponse {
        $this->requireUserId();
        $safeRepository = trim($repository);
        if (!preg_match('/^hacesoft\/[A-Za-z0-9_.-]{1,100}$/', $safeRepository)) {
            return new JSONResponse(['available' => false, 'error' => 'Unsupported repository.'], 400);
        }

        $knownIds = ['hacesoft/core' => 'hc_shared_app_core', 'hacesoft/playground' => 'hc_shared_app_core_playground',
            'hacesoft/gridsight' => 'hc_gridsight', 'hacesoft/nextcloud-stickynotes' => 'hc_stickynotes'];
        $appId = $appId !== '' ? $appId : ($knownIds[strtolower($safeRepository)] ?? '');
        if (!preg_match('/^[a-z][a-z0-9_]{1,63}$/', $appId)) {
            return new JSONResponse(['available' => false, 'error' => 'A valid application ID is required.'], 400);
        }
        $cacheKey = GitHubReleaseResolver::cacheKey($safeRepository, $appId);
        $cached = json_decode($this->getMigratedAppValue($cacheKey, '{}'), true);
        $now = time();
        if (!$refresh && is_array($cached) && isset($cached['checkedAt'])
            && $now - (int)$cached['checkedAt'] < (!empty($cached['available']) ? 21600 : 300)) {
            $cached['cached'] = true;
            return new JSONResponse($cached);
        }

        try {
            $release = $this->fetchLatestRelease($safeRepository, $appId);
            $payload = [
                'available' => true,
                'repository' => $safeRepository,
                'appId' => $appId,
                'version' => (string)$release['version'],
                'source' => (string)$release['source'],
                'sourceUrl' => (string)$release['sourceUrl'],
                'fileName' => $release['fileName'] ?? null,
                'tag' => (string)$release['tag'],
                'url' => (string)$release['url'],
                'checkedAt' => $now,
                'cached' => false,
            ];
            $this->config->setAppValue(Application::APP_ID, $cacheKey, json_encode($payload, JSON_THROW_ON_ERROR));
            return new JSONResponse($payload);
        } catch (\Throwable $exception) {
            if (is_array($cached) && isset($cached['version'])) {
                $cached['cached'] = true;
                $cached['stale'] = true;
                $cached['attemptedAt'] = $now;
                return new JSONResponse($cached);
            }
            $payload = ['available' => false, 'repository' => $safeRepository,
                'checkedAt' => $now, 'cached' => false,
                'error' => 'Version check is temporarily unavailable.'];
            $this->config->setAppValue(Application::APP_ID, $cacheKey, json_encode($payload, JSON_THROW_ON_ERROR));
            return new JSONResponse($payload);
        }
    }

    private function fetchLatestRelease(string $repository, string $appId): array {
        $client = $this->clientService->newClient();
        $options = [
            'headers' => [
                'Accept' => 'application/vnd.github+json',
                'User-Agent' => 'HC-Shared-App-Core/' . Application::VERSION,
                'X-GitHub-Api-Version' => '2022-11-28',
            ],
            'timeout' => 8,
            'connect_timeout' => 4,
        ];
        return (new GitHubReleaseResolver())->resolve($client, $repository, $options, $appId);
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function settings(string $namespace): JSONResponse {
        $userId = $this->requireUserId();
        $safeNamespace = $this->validateNamespace($namespace);
        $encoded = $this->getMigratedUserValue($userId, 'settings:' . $safeNamespace, '{}');
        $values = json_decode($encoded, true);

        return new JSONResponse(['values' => is_array($values) ? $values : []]);
    }

    #[NoAdminRequired]
    public function saveSettings(string $namespace, array $values = []): JSONResponse {
        $userId = $this->requireUserId();
        $safeNamespace = $this->validateNamespace($namespace);
        $safeValues = [];
        foreach ($values as $key => $value) {
            if (!is_string($key) || !preg_match('/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/', $key)) {
                return new JSONResponse(['error' => 'Invalid settings key.'], 400);
            }
            if (!is_string($value) && !is_int($value) && !is_float($value) && !is_bool($value) && $value !== null) {
                return new JSONResponse(['error' => 'Invalid settings value.'], 400);
            }
            $safeValues[$key] = $value;
        }
        $this->config->setUserValue(
            $userId,
            Application::APP_ID,
            'settings:' . $safeNamespace,
            json_encode($safeValues, JSON_THROW_ON_ERROR),
        );

        return new JSONResponse(['values' => $safeValues]);
    }

    private function requireUserId(): string {
        $user = $this->userSession->getUser();
        if ($user === null) {
            throw new \RuntimeException('Authenticated user is required.');
        }
        return $user->getUID();
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function sharees(string $query = '', string $types = 'user,group'): JSONResponse {
        $this->requireUserId();
        $safeQuery = mb_substr(trim($query), 0, 80);
        $allowedTypes = array_intersect(explode(',', $types), ['user', 'group']);
        $items = [];
        if (in_array('user', $allowedTypes, true)) {
            foreach ($this->userManager->search($safeQuery, 20, 0) as $user) {
                $items[] = ['id' => $user->getUID(), 'label' => $user->getDisplayName(), 'type' => 'user'];
            }
        }
        if (in_array('group', $allowedTypes, true)) {
            foreach ($this->groupManager->search($safeQuery, 20, 0) as $group) {
                $items[] = ['id' => $group->getGID(), 'label' => $group->getDisplayName(), 'type' => 'group'];
            }
        }
        usort($items, static fn (array $left, array $right): int => strcasecmp($left['label'], $right['label']));

        return new JSONResponse(['items' => array_slice($items, 0, 30)]);
    }

    private function validateNamespace(string $namespace): string {
        if (!preg_match('/^[a-z][a-z0-9_]{1,63}$/', $namespace)) {
            throw new \InvalidArgumentException('Invalid settings namespace.');
        }
        return $namespace;
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function mapFavorites(): JSONResponse {
        return new JSONResponse(['items' => $this->loadMapFavorites($this->requireUserId())]);
    }

    #[NoAdminRequired]
    public function addMapFavorite(array $favorite = []): JSONResponse {
        $userId = $this->requireUserId();
        $items = $this->loadMapFavorites($userId);
        $now = gmdate('c');
        $item = $this->validateMapFavorite($favorite, 'place_' . bin2hex(random_bytes(8)), $now, $now);
        $items[] = $item;
        $this->saveMapFavorites($userId, $items);
        return new JSONResponse(['item' => $item], 201);
    }

    #[NoAdminRequired]
    public function updateMapFavorite(string $id, array $changes = []): JSONResponse {
        $userId = $this->requireUserId();
        $items = $this->loadMapFavorites($userId);
        foreach ($items as $index => $existing) {
            if (($existing['id'] ?? '') !== $id) continue;
            $candidate = array_merge($existing, $changes, ['id' => $id, 'createdAt' => $existing['createdAt'], 'updatedAt' => gmdate('c')]);
            $items[$index] = $this->validateMapFavorite($candidate, $id, (string)$existing['createdAt'], (string)$candidate['updatedAt']);
            $this->saveMapFavorites($userId, $items);
            return new JSONResponse(['item' => $items[$index]]);
        }
        return new JSONResponse(['error' => 'Favorite place was not found.'], 404);
    }

    #[NoAdminRequired]
    public function deleteMapFavorite(string $id): JSONResponse {
        $userId = $this->requireUserId();
        $items = $this->loadMapFavorites($userId);
        $filtered = array_values(array_filter($items, static fn (array $item): bool => ($item['id'] ?? '') !== $id));
        if (count($filtered) === count($items)) return new JSONResponse(['error' => 'Favorite place was not found.'], 404);
        $this->saveMapFavorites($userId, $filtered);
        return new JSONResponse(['deleted' => true]);
    }

    private function loadMapFavorites(string $userId): array {
        $decoded = json_decode($this->getMigratedUserValue($userId, 'map:favorites', '[]'), true);
        return is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
    }

    private function saveMapFavorites(string $userId, array $items): void {
        if (count($items) > 500) throw new \InvalidArgumentException('Too many favorite places.');
        $this->config->setUserValue($userId, Application::APP_ID, 'map:favorites', json_encode(array_values($items), JSON_THROW_ON_ERROR));
    }

    private function getMigratedAppValue(string $key, string $default): string {
        $missing = '__HC_SHARED_APP_CORE_MISSING__';
        $value = $this->config->getAppValue(Application::APP_ID, $key, $missing);
        if ($value !== $missing) return $value;
        $legacy = $this->config->getAppValue(Application::LEGACY_APP_ID, $key, $missing);
        if ($legacy === $missing) return $default;
        $this->config->setAppValue(Application::APP_ID, $key, $legacy);
        return $legacy;
    }

    private function getMigratedUserValue(string $userId, string $key, string $default): string {
        $missing = '__HC_SHARED_APP_CORE_MISSING__';
        $value = $this->config->getUserValue($userId, Application::APP_ID, $key, $missing);
        if ($value !== $missing) return $value;
        $legacy = $this->config->getUserValue($userId, Application::LEGACY_APP_ID, $key, $missing);
        if ($legacy === $missing) return $default;
        $this->config->setUserValue($userId, Application::APP_ID, $key, $legacy);
        return $legacy;
    }

    private function validateMapFavorite(array $value, string $id, string $createdAt, string $updatedAt): array {
        $lat = filter_var($value['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        $lon = filter_var($value['lon'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($lat === false || $lon === false || $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) throw new \InvalidArgumentException('Invalid coordinates.');
        $name = mb_substr(trim((string)($value['name'] ?? '')), 0, 120);
        $sourceApp = mb_substr(trim((string)($value['sourceApp'] ?? '')), 0, 64);
        if ($name === '' || !preg_match('/^[a-z][a-z0-9_]{1,63}$/', $sourceApp)) throw new \InvalidArgumentException('Invalid favorite place.');
        $color = (string)($value['color'] ?? '#3388ff');
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#3388ff';
        return ['id' => $id, 'name' => $name, 'lat' => (float)$lat, 'lon' => (float)$lon, 'type' => mb_substr((string)($value['type'] ?? 'favorite'), 0, 40), 'icon' => mb_substr((string)($value['icon'] ?? 'star'), 0, 40), 'color' => $color, 'note' => mb_substr((string)($value['note'] ?? ''), 0, 1000), 'sourceApp' => $sourceApp, 'createdAt' => $createdAt, 'updatedAt' => $updatedAt];
    }
}
