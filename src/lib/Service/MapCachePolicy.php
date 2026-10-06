<?php
declare(strict_types=1);
namespace OCA\HcSharedAppCore\Service;

final class MapCachePolicy {
    /** Configuration is a ceiling, never an override of upstream freshness. */
    public static function fromHeaders(string $control, string $expires, string $age, int $ceiling): array {
        $control = strtolower($control);
        $store = !preg_match('/(?:^|,)\s*(?:no-store|private)(?:\s|,|=|$)/', $control);
        $revalidate = (bool)preg_match('/(?:^|,)\s*(?:no-cache|must-revalidate|proxy-revalidate)(?:\s|,|=|$)/', $control);
        $ttl = min(604800, max(0, $ceiling)); // Seven-day fallback for responses without freshness metadata.
        if (preg_match('/(?:^|,)\s*s-maxage\s*=\s*"?(\d+)/', $control, $m) || preg_match('/(?:^|,)\s*max-age\s*=\s*"?(\d+)/', $control, $m)) $ttl = max(0, (int)$m[1] - max(0, (int)$age));
        elseif ($expires !== '' && ($timestamp = strtotime($expires)) !== false) $ttl = max(0, $timestamp - time());
        $ttl = min(max(0, $ceiling), $ttl);
        if (!$store || preg_match('/(?:^|,)\s*no-cache(?:\s|,|=|$)/', $control)) $ttl = 0;
        return ['store' => (bool)$store, 'ttl' => $ttl, 'allowStale' => $store && !$revalidate];
    }
}
