<?php
declare(strict_types=1);
namespace OCA\HcSharedAppCore\Migration;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;
/** Frozen initial public schema; subsequent changes require new migrations. */
final class Version018000Date20261006092100 extends SimpleMigrationStep {
 public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
  $schema=$schemaClosure();
$changed = false;
$addColumn = static function ($table, string $name, string $type, array $options = []) use (&$changed): void {
    if (!$table->hasColumn($name)) {
        $table->addColumn($name, $type, $options);
        $changed = true;
    }
};
$addIndex = static function ($table, array $columns, string $name, bool $unique = false) use (&$changed): void {
    if (!$table->hasIndex($name)) {
        if ($unique) $table->addUniqueIndex($columns, $name);
        else $table->addIndex($columns, $name);
        $changed = true;
    }
};
$setPrimaryKey = static function ($table, array $columns) use (&$changed): void {
    if (!$table->hasPrimaryKey()) {
        $table->setPrimaryKey($columns);
        $changed = true;
    }
};

// hc_core_lists
if (!$schema->hasTable('hc_core_lists')) $changed = true;
{
$table = $schema->hasTable('hc_core_lists') ? $schema->getTable('hc_core_lists') : $schema->createTable('hc_core_lists');
            $addColumn($table, 'id', 'string', ['length' => 40]);
            $addColumn($table, 'namespace', 'string', ['length' => 64]);
            $addColumn($table, 'owner', 'string', ['length' => 64]);
            $addColumn($table, 'title', 'string', ['length' => 160]);
            $addColumn($table, 'archived', 'boolean', ['default' => false]);
            $addColumn($table, 'position', 'integer', ['default' => 0]);
            $addColumn($table, 'created_at', 'string', ['length' => 32]);
            $addColumn($table, 'updated_at', 'string', ['length' => 32]);
            $setPrimaryKey($table, ['id']);
            $addIndex($table, ['namespace', 'owner'], 'hc_lists_owner');
}

// hc_core_places
if (!$schema->hasTable('hc_core_places')) $changed = true;
{
$table = $schema->hasTable('hc_core_places') ? $schema->getTable('hc_core_places') : $schema->createTable('hc_core_places');
            $addColumn($table, 'id', 'string', ['length' => 40]);
            $addColumn($table, 'list_id', 'string', ['length' => 40]);
            $addColumn($table, 'payload', 'text');
            $addColumn($table, 'position', 'integer', ['default' => 0]);
            $setPrimaryKey($table, ['id']);
            $addIndex($table, ['list_id', 'position'], 'hc_places_order');
}

// hc_core_list_acl
if (!$schema->hasTable('hc_core_list_acl')) $changed = true;
{
$table = $schema->hasTable('hc_core_list_acl') ? $schema->getTable('hc_core_list_acl') : $schema->createTable('hc_core_list_acl');
            $addColumn($table, 'list_id', 'string', ['length' => 40]);
            $addColumn($table, 'target_type', 'string', ['length' => 8]);
            $addColumn($table, 'target_id', 'string', ['length' => 64]);
            $addColumn($table, 'permission', 'string', ['length' => 4]);
            $setPrimaryKey($table, ['list_id', 'target_type', 'target_id']);
            $addIndex($table, ['target_type', 'target_id'], 'hc_acl_target');
}

// Separate ACL for places.
if (!$schema->hasTable('hc_core_place_acl')) $changed = true;
$placeAcl = $schema->hasTable('hc_core_place_acl')
    ? $schema->getTable('hc_core_place_acl')
    : $schema->createTable('hc_core_place_acl');
$addColumn($placeAcl, 'place_id', 'string', ['length' => 40]);
$addColumn($placeAcl, 'target_type', 'string', ['length' => 8]);
$addColumn($placeAcl, 'target_id', 'string', ['length' => 64]);
$addColumn($placeAcl, 'permission', 'string', ['length' => 4]);
$setPrimaryKey($placeAcl, ['place_id', 'target_type', 'target_id']);
$addIndex($placeAcl, ['target_type', 'target_id'], 'hc_place_acl_target');

// Optional hierarchy fields on existing lists; never rewrite list/place rows.
$lists = $schema->getTable('hc_core_lists');
$addColumn($lists, 'parent_id', 'string', ['length' => 40, 'notnull' => false]);
$addColumn($lists, 'icon', 'string', ['length' => 16, 'default' => '📁']);
$addIndex($lists, ['namespace', 'parent_id'], 'hc_lists_parent');

 return $changed?$schema:null;
 }
}
