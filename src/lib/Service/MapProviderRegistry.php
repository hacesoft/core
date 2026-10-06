<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Service;

final class MapProviderRegistry {
    private const PROVIDERS = [
        'osm' => [
            'name' => 'OpenStreetMap',
            'mapsets' => ['basic'],
            'tileSizes' => [256],
            'requiresApiKey' => false,
            'ttl' => 31536000,
            'attribution' => '© OpenStreetMap contributors',
        ],
        'mapy' => [
            'name' => 'Mapy.com',
            'mapsets' => ['basic', 'outdoor', 'aerial', 'names-overlay', 'winter'],
            'tileSizes' => [256, 512],
            'requiresApiKey' => true,
            'ttl' => 31536000,
            'attribution' => '© Seznam.cz, a.s. and other copyright holders',
        ],
    ];

    public function list(): array {
        $providers = [];
        foreach (self::PROVIDERS as $id => $provider) {
            $providers[] = [
                'id' => $id,
                'name' => $provider['name'],
                'type' => 'tile',
                'cacheable' => true,
                'requiresApiKey' => $provider['requiresApiKey'],
                'mapsets' => $provider['mapsets'],
                'tileSizes' => $provider['tileSizes'],
                'attribution' => $provider['attribution'],
            ];
        }
        return $providers;
    }

    public function get(string $provider): array {
        if (!isset(self::PROVIDERS[$provider])) {
            throw new \InvalidArgumentException('Unsupported map provider.');
        }
        return self::PROVIDERS[$provider];
    }

    public function validateTile(string $provider, string $mapset, int $tileSize, int $z, int $x, int $y): array {
        $definition = $this->get($provider);
        if (!in_array($mapset, $definition['mapsets'], true)
            || !in_array($tileSize, $definition['tileSizes'], true)
            || $z < 0 || $z > 22) {
            throw new \InvalidArgumentException('Unsupported map tile parameters.');
        }
        $limit = 2 ** $z;
        if ($x < 0 || $y < 0 || $x >= $limit || $y >= $limit) {
            throw new \InvalidArgumentException('Map tile coordinates are outside the zoom grid.');
        }
        if ($provider === 'mapy' && $tileSize === 512 && !in_array($mapset, ['basic', 'outdoor'], true)) {
            throw new \InvalidArgumentException('Retina tiles are unavailable for this Mapy.com mapset.');
        }
        return $definition;
    }

    public function tileUrl(string $provider, string $mapset, int $tileSize, int $z, int $x, int $y, ?string $apiKey): string {
        if ($provider === 'osm') {
            return sprintf('https://tile.openstreetmap.org/%d/%d/%d.png', $z, $x, $y);
        }
        if ($provider === 'mapy' && $apiKey !== null && $apiKey !== '') {
            return sprintf(
                'https://api.mapy.com/v1/maptiles/%s/%d/%d/%d/%d?apikey=%s',
                rawurlencode($mapset), $tileSize, $z, $x, $y, rawurlencode($apiKey),
            );
        }
        throw new \RuntimeException('The provider API key is not configured.');
    }
}
