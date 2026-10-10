<?php
declare(strict_types=1);
namespace OCA\HcSharedAppCore\Migration;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;
/** Keep emoji in application data, not database column defaults. */
final class Version018004Date20261010090000 extends SimpleMigrationStep {
 public function changeSchema(IOutput $output, \Closure $schemaClosure, array $options): ?ISchemaWrapper {
  $schema = $schemaClosure();
  $column = $schema->getTable('hc_core_lists')->getColumn('icon');
  if ($column->getDefault() === '') return null;
  $column->setDefault('');
  return $schema;
 }
}
