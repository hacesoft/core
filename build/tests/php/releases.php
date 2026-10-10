<?php
declare(strict_types=1);
$source = getenv('HC_CORE_TEST_SOURCE') ?: __DIR__ . '/../../../src';
require $source . '/lib/Service/GitHubReleaseResolver.php';
use OCA\HcSharedAppCore\Service\GitHubReleaseResolver as Resolver;
function same(mixed $actual, mixed $expected): void {
    if ($actual !== $expected) throw new RuntimeException(var_export([$actual, $expected], true));
}
// App-config limits apply to failures and successful cached checks alike.
$key = Resolver::cacheKey('hacesoft/Playground', 'hc_shared_app_core_playground');
same(strlen($key) < 64, true);
same($key, Resolver::cacheKey('hacesoft/playground', 'hc_shared_app_core_playground'));
same($key !== Resolver::cacheKey('hacesoft/core', 'hc_shared_app_core'), true);
same($key !== Resolver::cacheKey('hacesoft/Playground', 'another_app'), true);
same(strlen(Resolver::cacheKey('hacesoft/' . str_repeat('r', 100), str_repeat('a', 64))) < 64, true);
foreach ([
    'hc_stickynotes-2.0.11-source.zip' => '2.0.11',
    'hc-shared-app-core-0.18.0-dev.16-full-source.zip' => '0.18.0-dev.16',
    'hc_shared_app_core-0.18.0-dev.9.tar.gz' => '0.18.0-dev.9',
    'hc_gridsight-0.9.1.zip' => '0.9.1',
    'demo-1.0.0-rc.1+build.2.tgz' => '1.0.0-rc.1+build.2',
    'README-9.9.9.md' => null, 'demo-01.0.0.zip' => null,
    'demo-1.0.0-dev.01.zip' => null,
] as $name => $expected) same(Resolver::archiveVersion($name), $expected);
foreach ([['0.18.0-dev.9', '0.18.0-dev.16'], ['1.0.0-rc.1', '1.0.0'], ['1.9.0', '1.10.0'], ['1.0.0-alpha.9', '1.0.0-alpha.beta']] as [$a,$b]) {
    same(Resolver::compare($a, $b) < 0, true);
    same(Resolver::compare($b, $a) > 0, true);
}
same(Resolver::compare('1.0.0+a', '1.0.0+b'), 0);
final class Client {
    public array $calls = [];
    public function __construct(private array $responses) {}
    public function get(string $url, array $options): object {
        $this->calls[] = $url;
        if (!array_key_exists($url, $this->responses)) throw new RuntimeException('404');
        $data = $this->responses[$url];
        return new class($data) {
            public function __construct(private array $data) {}
            public function getStatusCode(): int { return 200; }
            public function getBody(): string { return json_encode($this->data, JSON_THROW_ON_ERROR); }
        };
    }
}
$base = 'https://api.github.com/repos/hacesoft/core';
$resolver = new Resolver();
$xml = '<info><id>hc_shared_app_core</id><version>0.18.4</version></info>';
same(Resolver::parseInfoXml($xml, 'hc_shared_app_core')['version'], '0.18.4');
foreach ([
    '<info><id>other</id><version>0.18.4</version></info>',
    '<info><id>hc_shared_app_core</id><version>v0.18.4</version></info>',
    '<info><id>hc_shared_app_core</id><version>0.18.4</version><version>9.0.0</version></info>',
    '<info><id>hc_shared_app_core</id><version>0.18.4</info>',
    '<!DOCTYPE info [<!ENTITY x SYSTEM "file:///etc/passwd">]><info><id>hc_shared_app_core</id><version>&x;</version></info>',
] as $bad) {
    $rejected = false;
    try { Resolver::parseInfoXml($bad, 'hc_shared_app_core'); } catch (Throwable) { $rejected = true; }
    same($rejected, true);
}
$files = [
    ['type'=>'file', 'name'=>'core-0.18.0-dev.9-source.zip', 'html_url'=>'old'],
    ['type'=>'file', 'name'=>'core-0.18.4-full-source.zip', 'html_url'=>'new'],
    ['type'=>'dir', 'name'=>'core-99.0.0.zip'],
    ['type'=>'file', 'name'=>'notes-99.0.0.md'],
];
$infoUrl = $base.'/contents/src/appinfo/info.xml';
$metadata = ['type'=>'file', 'encoding'=>'base64', 'content'=>base64_encode($xml), 'html_url'=>'xml-link'];
$client = new Client([$infoUrl=>$metadata, $base.'/contents/release'=>[['type'=>'file','name'=>'core-99.0.0.zip']]]);
$result = $resolver->resolve($client, 'hacesoft/core', [], 'hc_shared_app_core');
same($result['version'], '0.18.4');
same($result['source'], 'appinfo-xml');
same($result['fileName'], 'src/appinfo/info.xml');
same(count($client->calls), 1);
$client = new Client([$base.'/contents/release'=>$files]);
$result = $resolver->resolve($client, 'hacesoft/core', [], 'hc_shared_app_core');
same($result['version'], '0.18.4');
same($result['source'], 'release-directory');
same(count($client->calls), 2);
$metadata['content'] = base64_encode('<info><id>other</id><version>9.0.0</version></info>');
$client = new Client([$infoUrl=>$metadata, $base.'/contents/release'=>$files]);
$rejected = false;
try { $resolver->resolve($client, 'hacesoft/core', [], 'hc_shared_app_core'); }
catch (UnexpectedValueException) { $rejected = true; }
same($rejected, true);
same(count($client->calls), 1);
$metadata['content'] = '!!!';
$client = new Client([$infoUrl=>$metadata, $base.'/contents/release'=>$files]);
same($resolver->resolve($client, 'hacesoft/core', [], 'hc_shared_app_core')['source'], 'release-directory');
echo "Release resolver tests passed.\n";
