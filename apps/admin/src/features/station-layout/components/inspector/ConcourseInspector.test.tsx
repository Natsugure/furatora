import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ConcourseInspector } from './ConcourseInspector';
import { createConcourseDraft, type ConcourseDraft } from '@/features/station-layout/domain/editDraft';
import type { LayoutConcourseDTO } from '@/features/station-layout/ports';
import type { FacilityTypeOption, ConnectedStationOption } from '@/features/facility/ports';

const concourse: LayoutConcourseDTO = {
  id: 'concourse-1',
  exits: 'A3出口',
  notes: null,
  cells: [{
    id: 'cell-1',
    xPositionMeters: 10,
    facilities: [{
      id: 'facility-1', typeCode: 'elevator', typeName: 'エレベーター',
      isWheelchairAccessible: true, isStrollerAccessible: true, notes: null,
    }],
  }],
  connections: [],
};

const facilityTypes: FacilityTypeOption[] = [
  { code: 'elevator', name: 'エレベーター' },
  { code: 'stairs', name: '階段' },
];

const connectedStations: ConnectedStationOption[] = [
  {
    id: 'station-shibuya', name: '渋谷', code: null,
    lines: [{ id: 'line-1', name: '田園都市線', color: '#00A650' }],
    platforms: [{ id: 'platform-shibuya-1', platformNumber: '1' }],
    directions: [{ id: 'direction-1', displayName: '渋谷方面' }],
  },
];

describe('ConcourseInspector', () => {
  it('出口の入力欄に既存値が表示される', () => {
    render(
      <MantineProvider>
        <ConcourseInspector
          draft={createConcourseDraft(concourse)}
          facilityTypes={facilityTypes}
          connectedStations={connectedStations}
          onChange={vi.fn()}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    expect(screen.getByLabelText('出口')).toHaveValue('A3出口');
  });

  it('新規設備タイプのチェックボックスをONにするとonChangeが呼ばれ、既定値で追加される', async () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <ConcourseInspector
          draft={createConcourseDraft(concourse)}
          facilityTypes={facilityTypes}
          connectedStations={connectedStations}
          onChange={onChange}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: '階段' }));

    expect(onChange).toHaveBeenCalled();
    const mutate = onChange.mock.calls[0]![0] as (d: ConcourseDraft) => ConcourseDraft;
    const next = mutate(createConcourseDraft(concourse));
    expect(next.cells[0]!.facilities).toContainEqual({
      typeCode: 'stairs', isWheelchairAccessible: true, isStrollerAccessible: true, notes: null,
    });
  });

  it('乗換可能な駅のチェックボックスをONにするとonChangeが呼ばれ、接続が追加される', async () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <ConcourseInspector
          draft={createConcourseDraft(concourse)}
          facilityTypes={facilityTypes}
          connectedStations={connectedStations}
          onChange={onChange}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );

    const user = userEvent.setup();
    // 出口・設備のチェックボックスと区別するため、乗換セクション内のチェックボックスを探す
    const checkboxes = screen.getAllByRole('checkbox');
    const stationCheckbox = checkboxes[checkboxes.length - 1]!;
    await user.click(stationCheckbox);

    expect(onChange).toHaveBeenCalled();
    const mutate = onChange.mock.calls[0]![0] as (d: ConcourseDraft) => ConcourseDraft;
    const next = mutate(createConcourseDraft(concourse));
    expect(next.connections).toContainEqual({
      stationId: 'station-shibuya', connectedPlatformId: null, directionId: null,
      exitLabel: null, xRangeStart: null, xRangeEnd: null,
    });
  });

  it('保存ボタンでonSaveが呼ばれる', async () => {
    const onSave = vi.fn();
    render(
      <MantineProvider>
        <ConcourseInspector
          draft={createConcourseDraft(concourse)}
          facilityTypes={facilityTypes}
          connectedStations={connectedStations}
          onChange={vi.fn()}
          onSave={onSave}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('isNewの場合はタイトルが「新規コンコース」になり、onDiscardが渡されていれば「取り消す」ボタンが出る', () => {
    render(
      <MantineProvider>
        <ConcourseInspector
          draft={createConcourseDraft(concourse)}
          facilityTypes={facilityTypes}
          connectedStations={connectedStations}
          onChange={vi.fn()}
          onSave={vi.fn()}
          onDiscard={vi.fn()}
          saving={false}
          isNew
        />
      </MantineProvider>,
    );
    expect(screen.getByRole('heading', { name: '新規コンコース' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取り消す' })).toBeInTheDocument();
  });
});
