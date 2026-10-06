<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Http;

use OCP\AppFramework\Http\Response;

final class MapTileResponse extends Response {
    public function __construct(
        private readonly string $content,
        string $contentType,
        array $headers = [],
        int $status = 200,
    ) {
        parent::__construct();
        $this->setStatus($status);
        $this->addHeader('Content-Type', $contentType);
        $this->addHeader('Content-Length', (string)strlen($content));
        $this->addHeader('X-Content-Type-Options', 'nosniff');
        foreach ($headers as $name => $value) {
            $this->addHeader((string)$name, (string)$value);
        }
    }

    public function render(): string {
        return $this->content;
    }
}
