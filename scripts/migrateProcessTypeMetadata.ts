/**
 * Migration Script: Populate Process Type Metadata in Database
 *
 * This script migrates color and label data from processTypeConfig.ts
 * into the machine_variables table, making it the single source of truth.
 *
 * Run this AFTER adding the new columns to machine_variables table in Xano:
 * - label (VARCHAR 255)
 * - color (VARCHAR 7)
 * - description (TEXT)
 * - is_active (BOOLEAN default TRUE)
 * - updated_at (BIGINT)
 * - updated_by (VARCHAR 255)
 *
 * Usage:
 *   npx ts-node scripts/migrateProcessTypeMetadata.ts
 */

import { getAllMachineVariables } from '../lib/api';
import { PROCESS_TYPE_CONFIGS } from '../lib/processTypeConfig';

interface MachineVariable {
  id: number;
  type: string;
  variables: Record<string, any>;
  label?: string;
  color?: string;
  description?: string;
  is_active?: boolean;
}

async function migrateMetadata() {
  console.log('Starting process type metadata migration...\n');

  try {
    // Fetch all existing machine variables from database
    const allVariables = await getAllMachineVariables();
    console.log(`Found ${allVariables.length} process types in database\n`);

    // Track migration results
    const results = {
      updated: [] as string[],
      skipped: [] as string[],
      failed: [] as { type: string; error: string }[],
    };

    // For each process type in the database
    for (const variable of allVariables) {
      const processType = variable.type;
      console.log(`Processing: ${processType}`);

      // Find matching config from hardcoded file
      const config = PROCESS_TYPE_CONFIGS.find(c => c.key === processType);

      if (!config) {
        console.log(`  ⚠️  No matching config found - will use defaults`);
        results.skipped.push(processType);
        continue;
      }

      // Prepare metadata update
      const metadata = {
        label: config.label,
        color: config.color,
        description: `${config.label} process type configuration`,
        is_active: true,
        updated_at: Date.now(),
        updated_by: 'migration_script',
      };

      console.log(`  ✓ Will update with: label="${metadata.label}", color="${metadata.color}"`);

      // Make PATCH request to update the record
      try {
        const response = await fetch(
          `https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb/machine_variables/${variable.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              // Note: You'll need to add auth token here if running this script
              // 'Authorization': `Bearer YOUR_TOKEN_HERE`,
            },
            body: JSON.stringify({
              machine_variables_id: variable.id,
              label: metadata.label,
              color: metadata.color,
              description: metadata.description,
              is_active: metadata.is_active,
              updated_at: metadata.updated_at,
              updated_by: metadata.updated_by,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        results.updated.push(processType);
        console.log(`  ✅ Successfully updated\n`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to update: ${errorMsg}\n`);
        results.failed.push({ type: processType, error: errorMsg });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Updated: ${results.updated.length} process types`);
    if (results.updated.length > 0) {
      results.updated.forEach(type => console.log(`   - ${type}`));
    }

    console.log(`\n⚠️  Skipped: ${results.skipped.length} process types (no matching config)`);
    if (results.skipped.length > 0) {
      results.skipped.forEach(type => console.log(`   - ${type}`));
    }

    console.log(`\n❌ Failed: ${results.failed.length} process types`);
    if (results.failed.length > 0) {
      results.failed.forEach(({ type, error }) => {
        console.log(`   - ${type}: ${error}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    if (results.failed.length > 0) {
      console.error('\n❌ Migration completed with errors');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Verify the data in Xano database');
      console.log('2. Update components to use database instead of processTypeConfig.ts');
      console.log('3. Test thoroughly');
      console.log('4. Remove processTypeConfig.ts file');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateMetadata();
}

export { migrateMetadata };
