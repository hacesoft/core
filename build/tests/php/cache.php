<?php
declare(strict_types=1);
// Standalone storage/policy regression test. Does not load or modify Nextcloud.
namespace OCP { interface ICache {} interface IConfig { public function getSystemValue(string $key, mixed $default = ''): mixed; } }
namespace {
$source = getenv('HC_CORE_TEST_SOURCE') ?: __DIR__ . '/../../../src';
require $source . '/lib/Service/MapTileStore.php';
require $source . '/lib/Service/MapCachePolicy.php';
require $source . '/lib/Service/MapRequestException.php';
require $source . '/lib/Service/MapService.php';
use OCA\HcSharedAppCore\Service\MapTileStore;
use OCA\HcSharedAppCore\Service\MapCachePolicy;
function store(string $directory): MapTileStore {
    return new MapTileStore(new class($directory) implements \OCP\IConfig {
        public function __construct(private string $directory) {}
        public function getSystemValue(string $key, mixed $default = ''): mixed { return $key === 'datadirectory' ? $this->directory : $default; }
    });
}
function entry(string $body = 'test-body', string $provider = 'osm'): array {
    return ['content' => $body, 'mime' => 'image/png', 'provider' => $provider, 'storedAt' => time(), 'freshUntil' => time()+60, 'allowStale' => false];
}
function check(bool $condition, string $message): void { if (!$condition) throw new \RuntimeException($message); }
function clean(string $path): void {
    foreach (scandir($path) ?: [] as $name) { if ($name === '.' || $name === '..') continue; $child = $path.'/'.$name; is_dir($child) ? clean($child) : unlink($child); }
    rmdir($path);
}
if (($argv[1] ?? '') === 'worker') {
    $s = store($argv[2]); $hash = hash('sha256', 'parallel');
    $s->withTile($hash, function() use($s,$hash,$argv): void {
        if ($s->get($hash) !== null) return;
        file_put_contents($argv[2].'/external-calls', "1\n", FILE_APPEND | LOCK_EX);
        usleep(400000);
        $s->put($hash, entry(), 1048576);
    });
    exit(0);
}
// Exercise the actual limiter method with an isolated counter double.
class FakeRedis implements \OCP\ICache {
    public int $value = 0;
    public bool $fail = false;
    public function add($key, $value, $ttl) { return true; }
    public function inc($key) { if ($this->fail) throw new \RuntimeException('private detail'); return ++$this->value; }
}
$reflection = new \ReflectionClass(\OCA\HcSharedAppCore\Service\MapService::class);
$service = $reflection->newInstanceWithoutConstructor();
$redis = new FakeRedis();
$reflection->getProperty('runtimeCache')->setValue($service, $redis);
$method = $reflection->getMethod('consumeRate');
$method->invoke($service, 'external', 1);
try { $method->invoke($service, 'external', 1); throw new \RuntimeException('Limiter failed to reject'); }
catch (\OCA\HcSharedAppCore\Service\MapRequestException $error) {
    check($error->httpStatus === 429 && $error->reason === 'rate_limit_external', 'Limit error misclassified');
    check($error->retryAfter >= 1 && $error->retryAfter <= 60, 'Invalid window wait');
}
$redis->fail = true;
try { $method->invoke($service, 'external', 1); throw new \RuntimeException('Redis failure was ignored'); }
catch (\OCA\HcSharedAppCore\Service\MapRequestException $error) {
    check($error->httpStatus === 503 && $error->reason === 'limiter_unavailable', 'Redis failure misclassified as 429');
}
$directory = sys_get_temp_dir().'/hc-core-cache-test-'.bin2hex(random_bytes(8));
mkdir($directory,0700);
try {
    check(MapCachePolicy::fromHeaders('max-age=120', '', '20', 500)['ttl'] === 100, 'Age not respected');
    check(MapCachePolicy::fromHeaders('s-maxage=80, max-age=120', '', '', 50)['ttl'] === 50, 'Shared TTL ceiling not respected');
    check(!MapCachePolicy::fromHeaders('private, max-age=120', '', '', 500)['store'], 'Private response cached');
    check(!MapCachePolicy::fromHeaders('no-store', '', '', 500)['store'], 'No-store response cached');
    $policy = MapCachePolicy::fromHeaders('no-cache', '', '', 500);
    check($policy['ttl'] === 0 && !$policy['allowStale'], 'No-cache response served stale');
    check(!MapCachePolicy::fromHeaders('must-revalidate, max-age=120', '', '', 500)['allowStale'], 'Must-revalidate response served stale');
    $s = store($directory); $hash = hash('sha256','tile'); $original = entry();
    $s->withTile($hash, fn() => $s->put($hash,$original,1048576));
    check($s->get($hash)['content'] === 'test-body', 'Round trip failed');
    check($s->get($hash)['freshUntil'] === $original['freshUntil'], 'Hit extended TTL');
    check($s->statistics(1048576)['entryCount'] === 1, 'Index count incorrect');
    file_put_contents($directory.'/hc_shared_app_core_maps_v2/'.$hash[0].'/dirty', '1');
    check($s->statistics(1048576)['entryCount'] === 1, 'Interrupted index recovery failed');
    $s->withTile($hash, fn() => $s->put($hash,entry('replacement'),1048576));
    check($s->statistics(1048576)['entryCount'] === 1 && $s->get($hash)['content'] === 'replacement', 'Atomic replacement failed');
    for ($i=0; $i<128; $i++) { $h = hash('sha256',(string)$i); $s->withTile($h, fn() => $s->put($h,entry(str_repeat('x',1000)),65536)); }
    $s->trim(65536); check($s->statistics(65536)['bytes'] <= 65536, 'Byte budget exceeded');
    $s->clear('all',null); check($s->statistics(65536)['entryCount'] === 0, 'Clear failed');
    check(function_exists('proc_open'), 'Concurrency test requires proc_open');
    $children = [];
    for ($i=0; $i<8; $i++) {
        $process = proc_open([PHP_BINARY,__FILE__,'worker',$directory], [0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file',$directory.'/worker-errors','a']], $pipes);
        check(is_resource($process), 'Cannot launch concurrent worker'); $children[]=$process;
    }
    foreach ($children as $process) check(proc_close($process) === 0, 'Concurrent worker failed');
    check(count(file($directory.'/external-calls')) === 1, 'Duplicate upstream fetch under concurrency');
    check($s->statistics(1048576)['entryCount'] === 1, 'Concurrent index mismatch');
    echo "Cache policy/storage/concurrency regression checks: PASS\n";
} finally { clean($directory); }
}
