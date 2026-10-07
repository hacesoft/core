<?php

declare(strict_types=1);

namespace OCA\HcSharedAppCore\Service;

/** Public GitHub metadata only; filenames are never treated as complete versions. */
final class GitHubReleaseResolver {
    private const SEMVER = '(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?';

    public static function normalizeTag(string $tag): string {
        // Allow v1.2.3 and application-prefixed tags, but no arbitrary trailing text.
        if (!preg_match('/(?:^|[-_])v?(' . self::SEMVER . ')$/D', trim($tag), $match)) {
            throw new \RuntimeException('GitHub tag is not a semantic version.');
        }
        $version = $match[1];
        $pre = explode('-', explode('+', $version, 2)[0], 2)[1] ?? '';
        foreach (explode('.', $pre) as $identifier) {
            if (preg_match('/^0[0-9]+$/D', $identifier)) {
                throw new \RuntimeException('Invalid numeric prerelease identifier.');
            }
        }
        return $version;
    }

    public static function archiveVersion(string $name): ?string {
        if (!preg_match('/\.(?:zip|tar\.gz|tgz)$/iD', $name)) return null;
        $stem = preg_replace('/\.(?:zip|tar\.gz|tgz)$/iD', '', $name) ?? '';
        $stem = preg_replace('/[-_](?:full[-_]source|source|runtime|install|bundle)$/iD', '', $stem) ?? '';
        try { return self::normalizeTag($stem); } catch (\RuntimeException) { return null; }
    }

    /** SemVer precedence, including numeric dev.9 < dev.16 and stable > prerelease. */
    public static function compare(string $a, string $b): int {
        $parts = static function (string $version): array {
            $version = explode('+', $version, 2)[0];
            $split = explode('-', $version, 2);
            return [explode('.', $split[0]), isset($split[1]) ? explode('.', $split[1]) : []];
        };
        $number = static function (string $x, string $y): int {
            return (strlen($x) <=> strlen($y)) ?: strcmp($x, $y);
        };
        [$ac, $ap] = $parts($a); [$bc, $bp] = $parts($b);
        for ($i = 0; $i < 3; $i++) { $c = $number($ac[$i], $bc[$i]); if ($c !== 0) return $c; }
        if ($ap === [] || $bp === []) return ($ap === [] ? 1 : 0) <=> ($bp === [] ? 1 : 0);
        for ($i = 0; $i < max(count($ap), count($bp)); $i++) {
            if (!isset($ap[$i])) return -1;
            if (!isset($bp[$i])) return 1;
            $x = $ap[$i]; $y = $bp[$i];
            if ($x === $y) continue;
            $xn = ctype_digit($x); $yn = ctype_digit($y);
            return $xn && $yn ? $number($x, $y) : ($xn !== $yn ? ($xn ? -1 : 1) : strcmp($x, $y));
        }
        return 0;
    }

    private function get(object $client, string $url, array $options): array {
        $response = $client->get($url, $options);
        if ($response->getStatusCode() !== 200) throw new \RuntimeException('GitHub metadata unavailable.');
        $data = json_decode($response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data)) throw new \RuntimeException('Invalid GitHub metadata.');
        return $data;
    }

    public static function parseInfoXml(string $xml, string $expectedId): array {
        if (strlen($xml) > 1048576 || stripos($xml, '<!DOCTYPE') !== false || stripos($xml, '<!ENTITY') !== false) {
            throw new \RuntimeException('Unsafe or oversized app metadata.');
        }
        $previous = libxml_use_internal_errors(true);
        try {
            $info = simplexml_load_string($xml, \SimpleXMLElement::class, LIBXML_NONET);
            if ($info === false || $info->getName() !== 'info' || count($info->id) !== 1 || count($info->version) !== 1) {
                throw new \RuntimeException('Invalid app metadata XML.');
            }
            $id = trim((string)$info->id);
            if ($expectedId === '' || $id !== $expectedId) {
                // A different product must never be accepted through archive fallback.
                throw new \UnexpectedValueException('Application ID does not match.');
            }
            $version = trim((string)$info->version);
            if (self::normalizeTag($version) !== $version) throw new \RuntimeException('Invalid app version.');
            return ['appId' => $id, 'version' => $version];
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    public function resolve(object $client, string $repository, array $options, string $expectedId): array {
        $base = 'https://api.github.com/repos/' . $repository;
        $infoUrl = $base . '/contents/src/appinfo/info.xml';
        try {
            $data = $this->get($client, $infoUrl, $options);
            if (($data['type'] ?? '') !== 'file' || ($data['encoding'] ?? '') !== 'base64' || !is_string($data['content'] ?? null)) {
                throw new \RuntimeException('GitHub app metadata is unavailable.');
            }
            if (strlen($data['content']) > 1500000) throw new \RuntimeException('Oversized encoded metadata.');
            $xml = base64_decode($data['content'], true);
            if ($xml === false) throw new \RuntimeException('Invalid metadata encoding.');
            $info = self::parseInfoXml($xml, $expectedId);
            return $info + ['tag' => $info['version'], 'source' => 'appinfo-xml',
                'sourceUrl' => $infoUrl, 'fileName' => 'src/appinfo/info.xml',
                'url' => $data['html_url'] ?? 'https://github.com/' . $repository . '/blob/HEAD/src/appinfo/info.xml'];
        } catch (\UnexpectedValueException $exception) {
            throw $exception;
        } catch (\Throwable) {
            // Missing/unusable XML falls back to archives in the release directory.
        }
        $url = $base . '/contents/release';
        $data = $this->get($client, $url, $options);
        $candidates = [];
        foreach ($data as $item) {
            if (!is_array($item) || ($item['type'] ?? '') !== 'file') continue;
            $name = (string)($item['name'] ?? '');
            $version = self::archiveVersion($name);
            if ($version === null) continue;
            $candidates[] = ['version' => $version, 'tag' => $version, 'source' => 'release-directory',
                'sourceUrl' => $url, 'fileName' => $name,
                'url' => $item['html_url'] ?? 'https://github.com/' . $repository . '/tree/HEAD/release'];
        }
        if ($candidates === []) throw new \RuntimeException('No semantic version was found.');
        return $this->newest($candidates);
    }

    private function newest(array $candidates): array {
        usort($candidates, static fn (array $a, array $b): int =>
            self::compare($b['version'], $a['version']) ?: strcmp($a['url'], $b['url']));
        return $candidates[0];
    }
}
