<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Service;

use OCA\HcSharedAppCore\AppInfo\Application;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\IGroupManager;
use OCP\IUserManager;

/** Shared, namespaced lists and places. All access checks run server-side. */
final class ListsService {
    public function __construct(
        private IDBConnection $db,
        private IConfig $config,
        private IGroupManager $groups,
        private IUserManager $users,
    ) {}

    private function rows(string $table, array $where = []): array {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')->from($table);
        foreach ($where as $column => $value) {
            $qb->andWhere($qb->expr()->eq($column, $qb->createNamedParameter($value)));
        }
        return $qb->executeQuery()->fetchAllAssociative();
    }

    private function one(string $table, array $where): ?array {
        return $this->rows($table, $where)[0] ?? null;
    }

    private function insert(string $table, array $data): void {
        $qb = $this->db->getQueryBuilder();
        $qb->insert($table);
        foreach ($data as $column => $value) $qb->setValue($column, $qb->createNamedParameter($value));
        $qb->executeStatement();
    }

    private function update(string $table, array $data, array $where): void {
        $qb = $this->db->getQueryBuilder();
        $qb->update($table);
        foreach ($data as $column => $value) $qb->set($column, $qb->createNamedParameter($value));
        foreach ($where as $column => $value) $qb->andWhere($qb->expr()->eq($column, $qb->createNamedParameter($value)));
        $qb->executeStatement();
    }

    private function delete(string $table, array $where): void {
        $qb = $this->db->getQueryBuilder();
        $qb->delete($table);
        foreach ($where as $column => $value) $qb->andWhere($qb->expr()->eq($column, $qb->createNamedParameter($value)));
        $qb->executeStatement();
    }

    public function namespace(string $namespace): string {
        if (!preg_match('/^[a-z][a-z0-9_]{1,63}$/', $namespace)) throw new \InvalidArgumentException('Invalid namespace.');
        return $namespace;
    }

    private function permission(array $list, string $uid): ?string {
        if ($list['owner'] === $uid) return 'owner';
        $access = null;
        $user = $this->users->get($uid);
        $groupIds = $user === null ? [] : $this->groups->getUserGroupIds($user);
        $visited = [];
        $current = $list;
        while ($current !== null) {
            if (isset($visited[$current['id']])) break;
            $visited[$current['id']] = true;
            foreach ($this->rows('hc_core_list_acl', ['list_id' => $current['id']]) as $share) {
                if (($share['target_type'] === 'user' && $share['target_id'] === $uid)
                    || ($share['target_type'] === 'group' && in_array($share['target_id'], $groupIds, true))) {
                    if ($share['permission'] === 'edit') return 'edit';
                    $access = 'read';
                }
            }
            $parentId = $current['parent_id'] ?? null;
            $parent = $parentId === null ? null : $this->one('hc_core_lists', ['namespace' => $list['namespace'], 'id' => $parentId]);
            // Invalid cross-owner links must never grant access to another user's data.
            $current = $parent !== null && $parent['owner'] === $list['owner'] ? $parent : null;
        }
        return $access;
    }

    private function accessible(string $namespace, string $id, string $uid, string $minimum = 'read'): array {
        $list = $this->one('hc_core_lists', ['namespace' => $this->namespace($namespace), 'id' => $id]);
        if ($list === null) throw new \RuntimeException('List not found.', 404);
        $permission = $this->permission($list, $uid);
        if ($permission === null || ($minimum === 'edit' && $permission === 'read') || ($minimum === 'owner' && $permission !== 'owner')) {
            throw new \RuntimeException('Access denied.', 403);
        }
        $list['permission'] = $permission;
        $list['archived'] = (bool)$list['archived'];
        return $list;
    }

    private function title(mixed $title): string {
        if (!is_string($title) || trim($title) === '' || mb_strlen($title) > 160) throw new \InvalidArgumentException('Invalid title.');
        return trim($title);
    }

    private function icon(mixed $icon): string {
        if (!is_string($icon) || mb_strlen($icon) > 16) throw new \InvalidArgumentException('Invalid list icon.');
        return $icon;
    }

    private function position(mixed $position): int {
        if (!is_int($position) || $position < 0 || $position > 1000000) throw new \InvalidArgumentException('Invalid position.');
        return $position;
    }

    /** Parents must belong to the same namespace and owner; reject cycles. */
    private function parentId(string $namespace, string $owner, mixed $parentId, ?string $childId = null): ?string {
        if ($parentId === null) return null;
        if (!is_string($parentId) || $parentId === '' || mb_strlen($parentId) > 40) {
            throw new \InvalidArgumentException('Invalid parent list.');
        }
        $seen = [];
        $current = $parentId;
        while ($current !== null) {
            if (isset($seen[$current]) || $current === $childId) {
                throw new \InvalidArgumentException('A list cannot contain itself.');
            }
            $seen[$current] = true;
            $parent = $this->one('hc_core_lists', ['namespace' => $namespace, 'id' => $current]);
            if ($parent === null || $parent['owner'] !== $owner) {
                throw new \InvalidArgumentException('Parent list must have the same owner.');
            }
            $current = $parent['parent_id'] ?? null;
        }
        return $parentId;
    }

    public function lists(string $namespace, string $uid): array {
        $namespace = $this->namespace($namespace);
        if ($namespace === 'map_places') $this->importFavorites($uid);
        $result = [];
        foreach ($this->rows('hc_core_lists', ['namespace' => $namespace]) as $list) {
            $permission = $this->permission($list, $uid);
            if ($permission === null) continue;
            $list['permission'] = $permission;
            $list['archived'] = (bool)$list['archived'];
            $result[] = $list;
        }
        usort($result, static fn ($a, $b) => [$a['position'], $a['title']] <=> [$b['position'], $b['title']]);
        return $result;
    }

    public function create(string $namespace, string $uid, array $input): array {
        $now = gmdate('c');
        $namespace = $this->namespace($namespace);
        $list = ['id' => 'list_' . bin2hex(random_bytes(12)), 'namespace' => $namespace, 'owner' => $uid,
            'title' => $this->title($input['title'] ?? null), 'icon' => $this->icon($input['icon'] ?? '📁'), 'archived' => 0,
            'position' => $this->position($input['position'] ?? 0),
            'parent_id' => $this->parentId($namespace, $uid, $input['parent_id'] ?? null),
            'created_at' => $now, 'updated_at' => $now];
        $this->insert('hc_core_lists', $list);
        $list['permission'] = 'owner';
        $list['archived'] = false;
        return $list;
    }

    public function edit(string $namespace, string $uid, string $id, array $input): array {
        $list = $this->accessible($namespace, $id, $uid, 'edit');
        $changes = [];
        if (array_key_exists('title', $input)) $changes['title'] = $this->title($input['title']);
        if (array_key_exists('icon', $input)) $changes['icon'] = $this->icon($input['icon']);
        if (array_key_exists('position', $input)) $changes['position'] = $this->position($input['position']);
        if (array_key_exists('parent_id', $input)) {
            if ($list['permission'] !== 'owner') throw new \RuntimeException('Only the owner can move a list.', 403);
            $changes['parent_id'] = $this->parentId($namespace, $list['owner'], $input['parent_id'], $id);
        }
        if (array_key_exists('archived', $input)) {
            if (!is_bool($input['archived'])) throw new \InvalidArgumentException('Invalid archive flag.');
            $changes['archived'] = (int)$input['archived'];
        }
        if ($changes !== []) {
            $changes['updated_at'] = gmdate('c');
            $this->update('hc_core_lists', $changes, ['id' => $id]);
        }
        return $this->accessible($namespace, $id, $uid);
    }

    public function places(string $namespace, string $uid, string $id): array {
        $list = $this->accessible($namespace, $id, $uid);
        $items = [];
        foreach ($this->rows('hc_core_places', ['list_id' => $id]) as $row) {
            $payload = json_decode($row['payload'], true);
            if (is_array($payload)) $items[] = $payload + [
                'id' => $row['id'], 'list_id' => $id, 'position' => (int)$row['position'],
                'permission' => $this->placePermission($list, $row['id'], $uid),
            ];
        }
        usort($items, static fn ($a, $b) => [$a['position'], $a['id']] <=> [$b['position'], $b['id']]);
        return $items;
    }

    private function placePermission(array $list, string $placeId, string $uid): ?string {
        $access = $this->permission($list, $uid);
        if ($access === 'owner' || $access === 'edit') return $access;
        $user = $this->users->get($uid);
        $groupIds = $user === null ? [] : $this->groups->getUserGroupIds($user);
        foreach ($this->rows('hc_core_place_acl', ['place_id' => $placeId]) as $share) {
            if (($share['target_type'] === 'user' && $share['target_id'] === $uid)
                || ($share['target_type'] === 'group' && in_array($share['target_id'], $groupIds, true))) {
                if ($share['permission'] === 'edit') return 'edit';
                $access = 'read';
            }
        }
        return $access;
    }

    /** Individually shared places are returned without their private list's other places. */
    public function sharedPlaces(string $namespace, string $uid): array {
        $items = [];
        foreach ($this->rows('hc_core_lists', ['namespace' => $this->namespace($namespace)]) as $list) {
            if ($this->permission($list, $uid) !== null) continue;
            foreach ($this->rows('hc_core_places', ['list_id' => $list['id']]) as $row) {
                $access = $this->placePermission($list, $row['id'], $uid);
                if ($access === null) continue;
                $payload = json_decode($row['payload'], true);
                if (is_array($payload)) $items[] = $payload + ['id' => $row['id'], 'list_id' => $list['id'], 'position' => (int)$row['position'], 'permission' => $access];
            }
        }
        usort($items, static fn ($a, $b) => [$a['position'], $a['id']] <=> [$b['position'], $b['id']]);
        return $items;
    }

    private function placePayload(array $data): array {
        $lat = filter_var($data['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        $lon = filter_var($data['lon'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($lat === false || $lon === false || $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) throw new \InvalidArgumentException('Invalid coordinates.');
        $name = $this->title($data['name'] ?? null);
        $note = $data['note'] ?? '';
        if (!is_string($note) || mb_strlen($note) > 4000) throw new \InvalidArgumentException('Invalid note.');
        $color = $data['color'] ?? '#3388ff';
        if (!is_string($color) || !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) throw new \InvalidArgumentException('Invalid color.');
        $payload = ['name' => $name, 'lat' => (float)$lat, 'lon' => (float)$lon, 'note' => $note, 'color' => $color];
        if (array_key_exists('favorite', $data)) {
            if (!is_bool($data['favorite'])) throw new \InvalidArgumentException('Invalid favorite flag.');
            $payload['favorite'] = $data['favorite'];
        }
        foreach (['type' => 40, 'icon' => 40, 'sourceApp' => 64, 'createdAt' => 40, 'updatedAt' => 40] as $field => $limit) {
            if (isset($data[$field])) {
                if (!is_string($data[$field]) || mb_strlen($data[$field]) > $limit) throw new \InvalidArgumentException('Invalid place metadata.');
                $payload[$field] = $data[$field];
            }
        }
        return $payload;
    }

    public function addPlace(string $namespace, string $uid, string $id, array $input): array {
        $this->accessible($namespace, $id, $uid, 'edit');
        $payload = $this->placePayload($input);
        $placeId = 'place_' . bin2hex(random_bytes(12));
        $position = $this->position($input['position'] ?? 0);
        $this->insert('hc_core_places', ['id' => $placeId, 'list_id' => $id, 'payload' => json_encode($payload, JSON_THROW_ON_ERROR), 'position' => $position]);
        return $payload + ['id' => $placeId, 'position' => $position];
    }

    public function editPlace(string $namespace, string $uid, string $id, string $placeId, array $input): array {
        $list = $this->one('hc_core_lists', ['namespace' => $this->namespace($namespace), 'id' => $id]);
        if ($list === null) throw new \RuntimeException('List not found.', 404);
        $row = $this->one('hc_core_places', ['id' => $placeId, 'list_id' => $id]);
        if ($row === null) throw new \RuntimeException('Place not found.', 404);
        if (!in_array($this->placePermission($list, $placeId, $uid), ['owner', 'edit'], true)) throw new \RuntimeException('Access denied.', 403);
        $current = json_decode($row['payload'], true);
        $payload = $this->placePayload(array_merge(is_array($current) ? $current : [], $input));
        $position = $this->position($input['position'] ?? (int)$row['position']);
        $this->update('hc_core_places', ['payload' => json_encode($payload, JSON_THROW_ON_ERROR), 'position' => $position], ['id' => $placeId, 'list_id' => $id]);
        return $payload + ['id' => $placeId, 'position' => $position];
    }

    /** Move within one owner's lists; keep the place ID and its direct shares. */
    public function movePlace(string $namespace, string $uid, string $id, string $placeId, string $targetId): array {
        $source = $this->one('hc_core_lists', ['namespace' => $this->namespace($namespace), 'id' => $id]);
        if ($source === null) throw new \RuntimeException('List not found.', 404);
        $row = $this->one('hc_core_places', ['id' => $placeId, 'list_id' => $id]);
        if ($row === null) throw new \RuntimeException('Place not found.', 404);
        if (!in_array($this->placePermission($source, $placeId, $uid), ['owner', 'edit'], true)) throw new \RuntimeException('Access denied.', 403);
        $target = $this->accessible($namespace, $targetId, $uid, 'edit');
        if ($target['owner'] !== $source['owner']) throw new \RuntimeException('Cannot move a place between owners.', 403);
        if ($id !== $targetId) $this->update('hc_core_places', ['list_id' => $targetId], ['id' => $placeId, 'list_id' => $id]);
        $payload = json_decode($row['payload'], true);
        return (is_array($payload) ? $payload : []) + [
            'id' => $placeId, 'list_id' => $targetId, 'position' => (int)$row['position'],
            'permission' => $this->placePermission($target, $placeId, $uid),
        ];
    }

    public function removePlace(string $namespace, string $uid, string $id, string $placeId): void {
        $list = $this->one('hc_core_lists', ['namespace' => $this->namespace($namespace), 'id' => $id]);
        if ($list === null) throw new \RuntimeException('List not found.', 404);
        if ($this->one('hc_core_places', ['id' => $placeId, 'list_id' => $id]) === null) throw new \RuntimeException('Place not found.', 404);
        if (!in_array($this->placePermission($list, $placeId, $uid), ['owner', 'edit'], true)) throw new \RuntimeException('Access denied.', 403);
        $this->db->beginTransaction();
        try {
            $this->delete('hc_core_place_acl', ['place_id' => $placeId]);
            $this->delete('hc_core_places', ['id' => $placeId, 'list_id' => $id]);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function shares(string $namespace, string $uid, string $id): array {
        $this->accessible($namespace, $id, $uid, 'owner');
        return $this->rows('hc_core_list_acl', ['list_id' => $id]);
    }

    public function placeShares(string $namespace, string $uid, string $listId, string $placeId): array {
        $this->accessible($namespace, $listId, $uid, 'owner');
        if ($this->one('hc_core_places', ['id' => $placeId, 'list_id' => $listId]) === null) throw new \RuntimeException('Place not found.', 404);
        return $this->rows('hc_core_place_acl', ['place_id' => $placeId]);
    }

    public function setPlaceShare(string $namespace, string $uid, string $listId, string $placeId, array $input): array {
        $list = $this->accessible($namespace, $listId, $uid, 'owner');
        if ($this->one('hc_core_places', ['id' => $placeId, 'list_id' => $listId]) === null) throw new \RuntimeException('Place not found.', 404);
        $type = $input['type'] ?? null;
        $target = $input['id'] ?? null;
        $permission = $input['permission'] ?? null;
        if (!in_array($type, ['user', 'group'], true) || !is_string($target) || $target === '' || mb_strlen($target) > 64
            || !in_array($permission, ['read', 'edit'], true)) throw new \InvalidArgumentException('Invalid share.');
        if (($type === 'user' && (!$this->users->userExists($target) || $target === $list['owner']))
            || ($type === 'group' && !$this->groups->groupExists($target))) throw new \InvalidArgumentException('Unknown share target.');
        $key = ['place_id' => $placeId, 'target_type' => $type, 'target_id' => $target];
        if ($this->one('hc_core_place_acl', $key) === null) $this->insert('hc_core_place_acl', $key + ['permission' => $permission]);
        else $this->update('hc_core_place_acl', ['permission' => $permission], $key);
        return $key + ['permission' => $permission];
    }

    public function removePlaceShare(string $namespace, string $uid, string $listId, string $placeId, string $type, string $target): void {
        $this->accessible($namespace, $listId, $uid, 'owner');
        if ($this->one('hc_core_places', ['id' => $placeId, 'list_id' => $listId]) === null) throw new \RuntimeException('Place not found.', 404);
        if (!in_array($type, ['user', 'group'], true)) throw new \InvalidArgumentException('Invalid share type.');
        $this->delete('hc_core_place_acl', ['place_id' => $placeId, 'target_type' => $type, 'target_id' => $target]);
    }

    public function setShare(string $namespace, string $uid, string $id, array $input): array {
        $list = $this->accessible($namespace, $id, $uid, 'owner');
        $type = $input['type'] ?? null;
        $target = $input['id'] ?? null;
        $permission = $input['permission'] ?? null;
        if (!in_array($type, ['user', 'group'], true) || !is_string($target) || $target === '' || mb_strlen($target) > 64
            || !in_array($permission, ['read', 'edit'], true)) throw new \InvalidArgumentException('Invalid share.');
        if (($type === 'user' && (!$this->users->userExists($target) || $target === $list['owner']))
            || ($type === 'group' && !$this->groups->groupExists($target))) throw new \InvalidArgumentException('Unknown share target.');
        $key = ['list_id' => $id, 'target_type' => $type, 'target_id' => $target];
        if ($this->one('hc_core_list_acl', $key) === null) $this->insert('hc_core_list_acl', $key + ['permission' => $permission]);
        else $this->update('hc_core_list_acl', ['permission' => $permission], $key);
        return $key + ['permission' => $permission];
    }

    public function removeShare(string $namespace, string $uid, string $id, string $type, string $target): void {
        $this->accessible($namespace, $id, $uid, 'owner');
        if (!in_array($type, ['user', 'group'], true)) throw new \InvalidArgumentException('Invalid share type.');
        $this->delete('hc_core_list_acl', ['list_id' => $id, 'target_type' => $type, 'target_id' => $target]);
    }

    /** Non-destructive, once per user. Legacy JSON is retained for rollback. */
    private function importFavorites(string $uid): void {
        $key = 'lists:map_places:imported';
        if ($this->config->getUserValue($uid, Application::APP_ID, $key, '') === '1') return;
        $missing = '__HC_MISSING__';
        $legacy = $this->config->getUserValue($uid, Application::APP_ID, 'map:favorites', $missing);
        if ($legacy === $missing) $legacy = $this->config->getUserValue($uid, Application::LEGACY_APP_ID, 'map:favorites', '[]');
        $favorites = json_decode($legacy, true);
        if (!is_array($favorites)) throw new \RuntimeException('Legacy favorites could not be decoded.');
        $this->db->beginTransaction();
        try {
            $list = $this->one('hc_core_lists', ['namespace' => 'map_places', 'owner' => $uid, 'title' => 'Imported favorites']);
            if ($favorites !== [] && $list === null) $list = $this->create('map_places', $uid, ['title' => 'Imported favorites']);
            if ($list !== null) foreach ($favorites as $index => $favorite) {
                if (!is_array($favorite)) continue;
                $placeId = (string)($favorite['id'] ?? '');
                if (!preg_match('/^place_[a-f0-9]{16,24}$/', $placeId)) $placeId = 'place_' . bin2hex(random_bytes(12));
                if ($this->one('hc_core_places', ['id' => $placeId]) !== null) continue;
                $payload = $this->placePayload($favorite);
                $this->insert('hc_core_places', ['id' => $placeId, 'list_id' => $list['id'], 'payload' => json_encode($payload, JSON_THROW_ON_ERROR), 'position' => (int)$index]);
            }
            $this->db->commit();
            $this->config->setUserValue($uid, Application::APP_ID, $key, '1');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
