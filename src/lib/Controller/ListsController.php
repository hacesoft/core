<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Controller;

use OCA\HcSharedAppCore\AppInfo\Application;
use OCA\HcSharedAppCore\Service\ListsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

final class ListsController extends Controller {
    public function __construct(IRequest $request, private IUserSession $session, private ListsService $lists) {
        parent::__construct(Application::APP_ID, $request);
    }

    private function uid(): string {
        $user = $this->session->getUser();
        if ($user === null) throw new \RuntimeException('Login required.', 401);
        return $user->getUID();
    }

    private function respond(callable $operation, int $success = 200): JSONResponse {
        try {
            return new JSONResponse($operation(), $success);
        } catch (\InvalidArgumentException $e) {
            return new JSONResponse(['error' => $e->getMessage()], 400);
        } catch (\RuntimeException $e) {
            $status = in_array($e->getCode(), [401, 403, 404], true) ? $e->getCode() : 500;
            return new JSONResponse(['error' => $status === 500 ? 'List operation failed.' : $e->getMessage()], $status);
        }
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function index(string $namespace): JSONResponse {
        return $this->respond(fn () => ['items' => $this->lists->lists($namespace, $this->uid())]);
    }

    #[NoAdminRequired]
    public function create(string $namespace, array $list = []): JSONResponse {
        return $this->respond(fn () => ['item' => $this->lists->create($namespace, $this->uid(), $list)], 201);
    }

    #[NoAdminRequired]
    public function edit(string $namespace, string $id, array $changes = []): JSONResponse {
        return $this->respond(fn () => ['item' => $this->lists->edit($namespace, $this->uid(), $id, $changes)]);
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function places(string $namespace, string $id): JSONResponse {
        return $this->respond(fn () => ['items' => $this->lists->places($namespace, $this->uid(), $id)]);
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function sharedPlaces(string $namespace): JSONResponse {
        return $this->respond(fn () => ['items' => $this->lists->sharedPlaces($namespace, $this->uid())]);
    }

    #[NoAdminRequired]
    public function addPlace(string $namespace, string $id, array $place = []): JSONResponse {
        return $this->respond(fn () => ['item' => $this->lists->addPlace($namespace, $this->uid(), $id, $place)], 201);
    }

    #[NoAdminRequired]
    public function editPlace(string $namespace, string $id, string $placeId, array $changes = []): JSONResponse {
        return $this->respond(fn () => ['item' => $this->lists->editPlace($namespace, $this->uid(), $id, $placeId, $changes)]);
    }

    #[NoAdminRequired]
    public function movePlace(string $namespace, string $id, string $placeId, string $targetListId = ''): JSONResponse {
        return $this->respond(fn () => ['item' => $this->lists->movePlace($namespace, $this->uid(), $id, $placeId, $targetListId)]);
    }

    #[NoAdminRequired]
    public function removePlace(string $namespace, string $id, string $placeId): JSONResponse {
        return $this->respond(function () use ($namespace, $id, $placeId) {
            $this->lists->removePlace($namespace, $this->uid(), $id, $placeId);
            return ['deleted' => true];
        });
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function placeShares(string $namespace, string $id, string $placeId): JSONResponse {
        return $this->respond(fn () => ['items' => $this->lists->placeShares($namespace, $this->uid(), $id, $placeId)]);
    }

    #[NoAdminRequired]
    public function setPlaceShare(string $namespace, string $id, string $placeId, array $share = []): JSONResponse {
        return $this->respond(fn () => ['item' => $this->lists->setPlaceShare($namespace, $this->uid(), $id, $placeId, $share)]);
    }

    #[NoAdminRequired]
    public function removePlaceShare(string $namespace, string $id, string $placeId, string $type, string $target): JSONResponse {
        return $this->respond(function () use ($namespace, $id, $placeId, $type, $target) {
            $this->lists->removePlaceShare($namespace, $this->uid(), $id, $placeId, $type, $target);
            return ['deleted' => true];
        });
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function shares(string $namespace, string $id): JSONResponse {
        return $this->respond(fn () => ['items' => $this->lists->shares($namespace, $this->uid(), $id)]);
    }

    #[NoAdminRequired]
    public function setShare(string $namespace, string $id, array $share = []): JSONResponse {
        return $this->respond(fn () => ['item' => $this->lists->setShare($namespace, $this->uid(), $id, $share)]);
    }

    #[NoAdminRequired]
    public function removeShare(string $namespace, string $id, string $type, string $target): JSONResponse {
        return $this->respond(function () use ($namespace, $id, $type, $target) {
            $this->lists->removeShare($namespace, $this->uid(), $id, $type, $target);
            return ['deleted' => true];
        });
    }
}
