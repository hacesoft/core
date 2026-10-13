import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
class MutationIntegrationChecks(unittest.TestCase):
    def test_all_map_favorite_mutations_guarded(self):
        source = (ROOT / 'src/lib/Controller/ApiController.php').read_text()
        for method, following in [('addMapFavorite','updateMapFavorite'),('updateMapFavorite','deleteMapFavorite'),('deleteMapFavorite','loadMapFavorites')]:
            span = source.split('function ' + method + '(', 1)[1].split('function ' + following + '(', 1)[0]
            self.assertIn("withFavoriteMutation($userId", span)
            self.assertLess(span.index("withFavoriteMutation($userId"), span.index('loadMapFavorites($userId)'))
            self.assertIn('saveMapFavorites($userId', span)
    def test_favorite_helper_uses_one_owner_scope(self):
        source = (ROOT / 'src/lib/Controller/ApiController.php').read_text()
        helper = source.split('private function withFavoriteMutation(', 1)[1].split('private function loadMapFavorites(', 1)[0]
        self.assertIn("synchronized('map:favorites', $userId, $operation)", helper)
        self.assertIn('new JSONResponse(', helper)
        self.assertIn(', 409)', helper)
    def test_hierarchy_rechecked_inside_critical_section(self):
        source = (ROOT / 'src/lib/Service/ListsService.php').read_text()
        span = source.split('public function edit(', 1)[1].split('public function places(',1)[0]
        self.assertIn("synchronized('lists:' . $list['namespace'], $list['owner']", span)
        lock_pos = span.index('synchronized(')
        self.assertGreater(span.find("$this->parentId(",lock_pos), lock_pos)
        self.assertGreater(span.find("$this->update('hc_core_lists'",lock_pos), lock_pos)
