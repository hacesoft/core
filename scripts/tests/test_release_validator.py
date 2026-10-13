import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('release_validation', ROOT / 'scripts/verify-release.py')
V = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(V)
V.app_id = 'hc_shared_app_core'
V.version = '0.18.4'
INFO = b'<info><id>hc_shared_app_core</id><version>0.18.4</version><dependencies><nextcloud min-version="35" max-version="35"/></dependencies></info>'

class ReleaseValidatorTests(unittest.TestCase):
    def make_zip(self, entries):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / 'candidate.zip'
        with zipfile.ZipFile(path, 'w') as z:
            for name, content in entries:
                z.writestr(name, content)
        return path

    def basic(self):
        root = 'hc_shared_app_core/'
        return [(root+'appinfo/info.xml', INFO), (root+'lib/Application.php', b'<?php')]

    def test_valid_runtime(self):
        V.verify(self.make_zip(self.basic()), 'hc_shared_app_core', True)

    def test_rejects_private_key(self):
        with self.assertRaisesRegex(ValueError, 'Forbidden runtime'):
            V.verify(self.make_zip(self.basic()+[('hc_shared_app_core/lib/private.key', b'secret')]), 'hc_shared_app_core', True)

    def test_rejects_docs(self):
        with self.assertRaisesRegex(ValueError, 'Non-runtime'):
            V.verify(self.make_zip(self.basic()+[('hc_shared_app_core/docs/internal.md', b'private')]), 'hc_shared_app_core', True)

    def test_rejects_traversal(self):
        with self.assertRaisesRegex(ValueError, 'Invalid archive path'):
            V.verify(self.make_zip(self.basic()+[('hc_shared_app_core/../bad', b'x')]), 'hc_shared_app_core', True)

    def test_rejects_missing_runtime(self):
        with self.assertRaisesRegex(ValueError, 'Missing PHP runtime'):
            V.verify(self.make_zip(self.basic()[:1]), 'hc_shared_app_core', True)

    def test_rejects_wrong_version(self):
        with self.assertRaisesRegex(ValueError, 'App ID/version mismatch'):
            V.verify(self.make_zip([('hc_shared_app_core/appinfo/info.xml', INFO.replace(b'0.18.4', b'0.0.0')), self.basic()[1]]), 'hc_shared_app_core', True)

if __name__ == '__main__':
    unittest.main()
