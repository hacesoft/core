<?php

declare(strict_types=1);

return [
    'routes' => [
        [
            'name' => 'api#status',
            'url' => '/api/v1/status',
            'verb' => 'GET',
        ],
        [
            'name' => 'api#settings',
            'url' => '/api/v1/settings',
            'verb' => 'GET',
        ],
        [
            'name' => 'api#saveSettings',
            'url' => '/api/v1/settings',
            'verb' => 'PUT',
        ],
        [
            'name' => 'api#sharees',
            'url' => '/api/v1/sharees',
            'verb' => 'GET',
        ],
        [
            'name' => 'api#release',
            'url' => '/api/v1/release',
            'verb' => 'GET',
        ],
        ['name' => 'api#mapFavorites', 'url' => '/api/v1/map-favorites', 'verb' => 'GET'],
        ['name' => 'api#addMapFavorite', 'url' => '/api/v1/map-favorites', 'verb' => 'POST'],
        ['name' => 'api#updateMapFavorite', 'url' => '/api/v1/map-favorites/{id}', 'verb' => 'PUT'],
        ['name' => 'api#deleteMapFavorite', 'url' => '/api/v1/map-favorites/{id}', 'verb' => 'DELETE'],
        ['name' => 'lists#index', 'url' => '/api/v1/lists/{namespace}', 'verb' => 'GET'],
        ['name' => 'lists#create', 'url' => '/api/v1/lists/{namespace}', 'verb' => 'POST'],
        ['name' => 'lists#edit', 'url' => '/api/v1/lists/{namespace}/{id}', 'verb' => 'PUT'],
        ['name' => 'lists#places', 'url' => '/api/v1/lists/{namespace}/{id}/places', 'verb' => 'GET'],
        ['name' => 'lists#sharedPlaces', 'url' => '/api/v1/lists/{namespace}/shared-places', 'verb' => 'GET'],
        ['name' => 'lists#addPlace', 'url' => '/api/v1/lists/{namespace}/{id}/places', 'verb' => 'POST'],
        ['name' => 'lists#editPlace', 'url' => '/api/v1/lists/{namespace}/{id}/places/{placeId}', 'verb' => 'PUT'],
        ['name' => 'lists#movePlace', 'url' => '/api/v1/lists/{namespace}/{id}/places/{placeId}/move', 'verb' => 'POST'],
        ['name' => 'lists#removePlace', 'url' => '/api/v1/lists/{namespace}/{id}/places/{placeId}', 'verb' => 'DELETE'],
        ['name' => 'lists#placeShares', 'url' => '/api/v1/lists/{namespace}/{id}/places/{placeId}/shares', 'verb' => 'GET'],
        ['name' => 'lists#setPlaceShare', 'url' => '/api/v1/lists/{namespace}/{id}/places/{placeId}/shares', 'verb' => 'PUT'],
        ['name' => 'lists#removePlaceShare', 'url' => '/api/v1/lists/{namespace}/{id}/places/{placeId}/shares/{type}/{target}', 'verb' => 'DELETE'],
        ['name' => 'lists#shares', 'url' => '/api/v1/lists/{namespace}/{id}/shares', 'verb' => 'GET'],
        ['name' => 'lists#setShare', 'url' => '/api/v1/lists/{namespace}/{id}/shares', 'verb' => 'PUT'],
        ['name' => 'lists#removeShare', 'url' => '/api/v1/lists/{namespace}/{id}/shares/{type}/{target}', 'verb' => 'DELETE'],
        ['name' => 'maps#providers', 'url' => '/api/v1/maps/providers', 'verb' => 'GET'],
        ['name' => 'maps#tile', 'url' => '/api/v1/maps/tile/{provider}/{mapset}/{tileSize}/{z}/{x}/{y}', 'verb' => 'GET'],
        ['name' => 'maps#runtime', 'url' => '/api/v1/maps/runtime', 'verb' => 'GET'],
        ['name' => 'maps#diagnostics', 'url' => '/api/v1/maps/diagnostics', 'verb' => 'GET'],
        ['name' => 'maps#offerKey', 'url' => '/api/v1/maps/provider-key', 'verb' => 'POST'],
        ['name' => 'maps#setProviderEnabled', 'url' => '/api/v1/maps/provider/{provider}/enabled', 'verb' => 'PUT'],
        ['name' => 'maps#configure', 'url' => '/api/v1/maps/config', 'verb' => 'PUT'],
        ['name' => 'maps#clearCache', 'url' => '/api/v1/maps/cache/clear', 'verb' => 'POST'],
    ],
];
