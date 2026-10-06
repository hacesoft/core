#!/usr/bin/env python3
"""Exercise the shared installer guard against real duplicate app directories."""
from pathlib import Path
import os
import subprocess
import tempfile

source = Path(__file__).resolve().parents[2] / 'scripts/custom-apps-safety.sh'
with tempfile.TemporaryDirectory(prefix='hc-custom-apps-') as temporary:
    base = Path(temporary)
    root = base / 'custom_apps'
    data = base / 'data'
    fake_bin = base / 'bin'
    root.mkdir()
    data.mkdir()
    fake_bin.mkdir()

    def app(name: str, app_id: str) -> None:
        info = root / name / 'appinfo' / 'info.xml'
        info.parent.mkdir(parents=True)
        info.write_text(f'<info><id>{app_id}</id></info>\n')

    app('lineamonitor', 'lineamonitor')
    app('lineamonitor.new.9111', 'lineamonitor')
    app('lineamonitor.new.10800', 'lineamonitor')
    app('external-app.new.12', 'external-app')

    helper = base / 'helper.sh'
    helper.write_text(source.read_text().replace('root=/var/www/html/custom_apps', f'root={root}'))
    docker = fake_bin / 'docker'
    docker.write_text('#!/bin/sh\n[ "$1" = exec ] || exit 2\nshift 2\nexec "$@"\n')
    docker.chmod(0o755)
    php = fake_bin / 'php'
    php.write_text('#!/bin/sh\nprintf %s "$HC_TEST_DATA_DIR"\n')
    php.chmod(0o755)
    env = {**os.environ, 'PATH': f'{fake_bin}:{os.environ["PATH"]}', 'HC_TEST_DATA_DIR': str(data)}

    def guard() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ['/bin/sh', '-c', '. "$1"; hc_clean_custom_apps lineamonitor web cron', 'sh', str(helper)],
            env=env, text=True, capture_output=True, check=False,
        )

    first = guard()
    assert first.returncode == 0, first.stderr
    assert first.stdout.count('WARNING: Moved duplicate') == 2, first.stdout
    assert (root / 'lineamonitor/appinfo/info.xml').is_file()
    assert (root / 'external-app.new.12/appinfo/info.xml').is_file()
    assert not list(root.glob('lineamonitor.new.*'))
    quarantined = list((data / 'hc-core-deployment-backups/custom-apps-quarantine').iterdir())
    assert len(quarantined) == 2
    assert all((path / 'appinfo/info.xml').is_file() for path in quarantined)

    second = guard()
    assert second.returncode == 0, second.stderr
    assert 'WARNING:' not in second.stdout
    assert len(list((data / 'hc-core-deployment-backups/custom-apps-quarantine').iterdir())) == 2

    app('hc_weather.new.99', 'hc_weather')
    refused = guard()
    assert refused.returncode != 0 and 'refusing to move its only copy' in refused.stderr
    assert (root / 'hc_weather.new.99/appinfo/info.xml').is_file()

    stages = [base / name for name in ('web-stage', 'web-new', 'web-lint', 'cron-stage', 'cron-new')]
    for stage in stages:
        stage.mkdir()
        (stage / 'appinfo').mkdir()
    cleanup_env = {
        **env,
        'WEB_CONTAINER': 'web', 'CRON_CONTAINER': 'cron',
        'REMOTE_TMP': str(stages[0]), 'NEW_DIR': str(stages[1]),
        'LINT_STAGE': str(stages[2]), 'CRON_TMP': str(stages[3]),
        'CRON_NEW': str(stages[4]),
    }
    cleaned = subprocess.run(
        ['/bin/sh', '-c', '. "$1"; hc_cleanup_install_stage', 'sh', str(helper)],
        env=cleanup_env, text=True, capture_output=True, check=False,
    )
    assert cleaned.returncode == 0, cleaned.stderr
    assert not any(stage.exists() for stage in stages)
    assert len(list((data / 'hc-core-deployment-backups/custom-apps-quarantine').iterdir())) == 2
    assert (root / 'lineamonitor/appinfo/info.xml').is_file()

print('Installer guard: preserves backups, quarantines duplicates, cleans private staging only')
