import { db } from '@furatora/database/client';
import { facilityTypes, operators } from '@furatora/database/schema';

const FACILITY_TYPES = [
  { code: 'elevator', name: 'エレベーター' },
  { code: 'escalator', name: 'エスカレーター' },
  { code: 'stairs', name: '階段' },
  { code: 'ramp', name: 'スロープ'},
  { code: 'stairLift', name: '階段昇降機' },
  { code: 'sameFloor', name: '同一階層'}
];

const OPERATORS = [
  {
    name: '東京メトロ',
    odptOperatorId: 'odpt.Operator:TokyoMetro',
    displayPriority: 1,
  },
  {
    name: '東京都交通局',
    odptOperatorId: 'odpt.Operator:Toei',
    displayPriority: 2,
  },
];

async function main() {
  console.log('Starting master data seed...');

  try {
    await db
      .insert(facilityTypes)
      .values(FACILITY_TYPES)
      .onConflictDoNothing({ target: facilityTypes.code });

    console.log(`✓ Seeded ${FACILITY_TYPES.length} facility types`);

    await db
      .insert(operators)
      .values(OPERATORS)
      .onConflictDoNothing({ target: operators.name });

    console.log(`✓ Seeded ${OPERATORS.length} operators`);

    console.log('Master data seed completed successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
