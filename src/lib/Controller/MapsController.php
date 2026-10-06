<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Controller;

use OCA\HcSharedAppCore\AppInfo\Application;
use OCA\HcSharedAppCore\Http\MapTileResponse;
use OCA\HcSharedAppCore\Service\MapService;
use OCA\HcSharedAppCore\Service\MapRequestException;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IGroupManager;
use OCP\IRequest;
use OCP\IUserSession;

final class MapsController extends Controller {
    public function __construct(
        IRequest $request,
        private readonly MapService $maps,
        private readonly IUserSession $userSession,
        private readonly IGroupManager $groupManager,
    ) { parent::__construct(Application::APP_ID, $request); }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function providers(): JSONResponse {
        $this->requireUser();
        return new JSONResponse(['providers' => $this->maps->providers()]);
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function tile(string $provider, string $mapset, int $tileSize, int $z, int $x, int $y): MapTileResponse|JSONResponse {
        $this->requireUser();
        try {
            $tile = $this->maps->tile($provider, $mapset, $tileSize, $z, $x, $y);
            return new MapTileResponse($tile['content'], $tile['mime'], $tile['headers']);
        } catch (\InvalidArgumentException $exception) {
            return new JSONResponse(['error' => $exception->getMessage()], 400);
        } catch (\RuntimeException $exception) {
            $status = $exception instanceof MapRequestException ? $exception->httpStatus : 503;
            $reason = $exception instanceof MapRequestException ? $exception->reason : 'cache_unavailable';
            $retryAfter = $exception instanceof MapRequestException ? $exception->retryAfter : 5;
            $response = new JSONResponse(['error' => $status === 429 ? 'Map request limit reached. Retry later.' : 'Map service temporarily unavailable.', 'code' => $reason, 'retryAfter' => $retryAfter], $status);
            $response->addHeader('Cache-Control', 'no-store');
            $response->addHeader('Retry-After', (string)$retryAfter);
            $response->addHeader('X-HC-Core-Map-Error', $reason);
            return $response;
        }
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function diagnostics(): JSONResponse {
        $userId = $this->requireUser();
        return new JSONResponse([
            ...$this->maps->diagnostics(),
            'canManage' => $this->groupManager->isAdmin($userId),
        ]);
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function runtime(): JSONResponse {
        $this->requireUser();
        $response = new JSONResponse($this->maps->runtimeStatus());
        $response->addHeader('Cache-Control', 'no-store');
        return $response;
    }

    public function offerKey(string $provider, string $sourceApp, string $key, bool $activate = true): JSONResponse {
        $this->requireAdmin();
        try { return new JSONResponse($this->maps->offerKey($provider, $sourceApp, trim($key), $activate)); }
        catch (\InvalidArgumentException $exception) { return new JSONResponse(['error' => $exception->getMessage()], 400); }
        catch (\Throwable $exception) { return new JSONResponse(['error' => 'Provider key validation failed. Existing key was retained.'], 422); }
    }

    public function setProviderEnabled(string $provider, bool $enabled): JSONResponse {
        $this->requireAdmin();
        try { return new JSONResponse($this->maps->setProviderEnabled($provider, $enabled)); }
        catch (\InvalidArgumentException $exception) { return new JSONResponse(['error' => $exception->getMessage()], 400); }
        catch (\RuntimeException) { return new JSONResponse(['error' => 'Cache operation could not complete. Refresh diagnostics before retrying.'], 503); }
    }

    public function configure(string $defaultProvider = 'osm', int $cacheLimitBytes = 536870912, int $tileCacheTtlDays = 365, int $browserCacheTtlDays = 7, int $tileRequestsPerMinute = 10000, int $externalRequestsPerMinute = 5000, array $allowedMapsets = []): JSONResponse {
        $this->requireAdmin();
        try { return new JSONResponse($this->maps->configure($defaultProvider, $cacheLimitBytes, $tileCacheTtlDays, $browserCacheTtlDays, $tileRequestsPerMinute, $externalRequestsPerMinute, $allowedMapsets)); }
        catch (\InvalidArgumentException $exception) { return new JSONResponse(['error' => $exception->getMessage()], 400); }
        catch (\RuntimeException) { return new JSONResponse(['error' => 'Cache operation could not complete. Refresh diagnostics before retrying.'], 503); }
    }

    public function clearCache(string $mode = 'expired', ?string $provider = null, bool $confirm = false): JSONResponse {
        $this->requireAdmin();
        try { return new JSONResponse($this->maps->clearCache($mode, $provider, $confirm)); }
        catch (\InvalidArgumentException $exception) { return new JSONResponse(['error' => $exception->getMessage()], 400); }
        catch (\RuntimeException) { return new JSONResponse(['error' => 'Cache operation could not complete. Refresh diagnostics before retrying.'], 503); }
    }

    private function requireUser(): string {
        $user = $this->userSession->getUser();
        if ($user === null) throw new \RuntimeException('Authenticated user is required.');
        return $user->getUID();
    }

    private function requireAdmin(): void {
        if (!$this->groupManager->isAdmin($this->requireUser())) throw new \RuntimeException('Administrator privileges are required.');
    }
}
