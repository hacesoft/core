<?php
declare(strict_types=1);
namespace OCA\HcSharedAppCore\Service;
/** Safe public error: never contains provider URLs or credentials. */
final class MapRequestException extends \RuntimeException {
    public function __construct(public readonly string $reason, public readonly int $httpStatus, public readonly int $retryAfter) {
        parent::__construct($reason);
    }
}
