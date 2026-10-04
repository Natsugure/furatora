import { db } from '@furatora/database/client';
import { facilityTypes, operators } from '@furatora/database/schema';
import { FACILITY_TYPE_CODES, type FacilityTypeCode } from '@furatora/database/enums';

// 設備コードの一覧の正は FACILITY_TYPE_CODES（ADR-0016）。Record にしているので、表示名の足し忘れはコンパイルエラーになる
const FACILITY_TYPE_NAMES: Record<FacilityTypeCode, string> = {
  sameFloor: '同一階層',
  elevator: 'エレベーター',
  ramp: 'スロープ',
  wheelchairEscalator: '車いす対応エスカレーター',
  escalator: 'エスカレーター',
  stairLift: '階段昇降機',
  stairs: '階段',
};

const FACILITY_TYPES = FACILITY_TYPE_CODES.map((code) => ({ code, name: FACILITY_TYPE_NAMES[code] }));

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
