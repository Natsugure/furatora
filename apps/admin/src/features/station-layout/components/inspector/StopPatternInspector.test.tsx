import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { StopPatternCreateForm, StopPatternInspector } from './StopPatternInspector';
import type { TrainOptionDTO } from '@/features/stop-pattern/domain/types';

const trains: TrainOptionDTO[] = [
  {
    id: 'train-1', name: '銀座線', carCount: 3,
    cars: [
      { carNumber: 1, carLength: 20, doorCount: 4 },
      { carNumber: 2, carLength: 20, doorCount: 4 },
      { carNumber: 3, carLength: 20, doorCount: 4 },
    ],
  },
  {
    id: 'train-2', name: '丸ノ内線', carCount: 2,
    cars: [
      { carNumber: 1, carLength: 20, doorCount: 4 },
      { carNumber: 2, carLength: 20, doorCount: 4 },
    ],
  },
];

describe('StopPatternCreateForm', () => {
  it('既にパターンを持つ列車は選択肢から除外される', () => {
    render(
      <MantineProvider>
        <StopPatternCreateForm trains={trains} excludeTrainIds={['train-1']} onPreview={vi.fn()} onCancel={vi.fn()} />
      </MantineProvider>,
    );
    const select = screen.getByLabelText('列車', { exact: false }) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).not.toContain('銀座線（3両）');
    expect(optionLabels).toContain('丸ノ内線（2両）');
  });

  it('列車選択+プレビューでbuildCarSegments()の結果がonPreviewに渡る', async () => {
    const onPreview = vi.fn();
    render(
      <MantineProvider>
        <StopPatternCreateForm trains={trains} excludeTrainIds={[]} onPreview={onPreview} onCancel={vi.fn()} />
      </MantineProvider>,
    );
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('列車', { exact: false }), 'train-2');
    await user.click(screen.getByRole('button', { name: '自動計算してプレビュー' }));

    expect(onPreview).toHaveBeenCalledWith('train-2', [
      { carNumber: 1, startMeters: 0, endMeters: 20 },
      { carNumber: 2, startMeters: 20, endMeters: 40 },
    ]);
  });

  it('列車未選択でプレビューを押すとエラーメッセージが出る', async () => {
    render(
      <MantineProvider>
        <StopPatternCreateForm trains={trains} excludeTrainIds={[]} onPreview={vi.fn()} onCancel={vi.fn()} />
      </MantineProvider>,
    );
    // ボタンはdisabledなのでfireEventで直接クリックしてハンドラを検証する必要はない。
    // 代わりにdisabled状態そのものを確認する
    expect(screen.getByRole('button', { name: '自動計算してプレビュー' })).toBeDisabled();
  });
});

describe('StopPatternInspector', () => {
  const cars = [
    { carNumber: 1, startMeters: 0, endMeters: 20 },
    { carNumber: 2, startMeters: 20, endMeters: 40 },
  ];

  it('境界の数値入力を変更するとonMoveCarBoundaryが呼ばれる', async () => {
    const onMoveCarBoundary = vi.fn();
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={onMoveCarBoundary}
          onMoveCarEdge={vi.fn()}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '展開する' }));
    fireEvent.change(screen.getByLabelText('1号車と2号車の境界'), { target: { value: '25' } });
    expect(onMoveCarBoundary).toHaveBeenCalledWith(0, 25);
  });

  it('先頭・末尾の数値入力を変更するとonMoveCarEdgeが呼ばれる', async () => {
    const onMoveCarEdge = vi.fn();
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={vi.fn()}
          onMoveCarEdge={onMoveCarEdge}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '展開する' }));
    fireEvent.change(screen.getByLabelText('1号車の先頭'), { target: { value: '-5' } });
    expect(onMoveCarEdge).toHaveBeenCalledWith({ carNumber: 1, side: 'start' }, -5);

    fireEvent.change(screen.getByLabelText('2号車の末尾'), { target: { value: '45' } });
    expect(onMoveCarEdge).toHaveBeenCalledWith({ carNumber: 2, side: 'end' }, 45);
  });

  it('反転編成では境界・外端のラベルと呼び出しフィールドが入れ替わる', async () => {
    const onMoveCarBoundary = vi.fn();
    const onMoveCarEdge = vi.fn();
    const reversedCars = [
      { carNumber: 1, startMeters: 20, endMeters: 40 },
      { carNumber: 2, startMeters: 0, endMeters: 20 },
    ];
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="丸ノ内線"
          cars={reversedCars}
          onMoveCarBoundary={onMoveCarBoundary}
          onMoveCarEdge={onMoveCarEdge}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '展開する' }));
    // 反転編成: 境界の共有座標は1号車のstart（20）
    expect(screen.getByLabelText('1号車と2号車の境界')).toHaveValue('20 m');
    fireEvent.change(screen.getByLabelText('1号車の先頭'), { target: { value: '45' } });
    expect(onMoveCarEdge).toHaveBeenCalledWith({ carNumber: 1, side: 'end' }, 45);
    fireEvent.change(screen.getByLabelText('2号車の末尾'), { target: { value: '-5' } });
    expect(onMoveCarEdge).toHaveBeenCalledWith({ carNumber: 2, side: 'start' }, -5);
  });

  it('保存ボタンでonSaveが呼ばれる', async () => {
    const onSave = vi.fn();
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={vi.fn()}
          onMoveCarEdge={vi.fn()}
          onSave={onSave}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '展開する' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('isNewの場合はタイトルに「（新規）」が付き、onDiscardがあれば「取り消す」ボタンが出る', () => {
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={vi.fn()}
          onMoveCarEdge={vi.fn()}
          onSave={vi.fn()}
          onDiscard={vi.fn()}
          saving={false}
          isNew
        />
      </MantineProvider>,
    );
    expect(screen.getByRole('heading', { name: '銀座線 の停車位置（新規）' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取り消す' })).toBeInTheDocument();
  });

  it('isNewの場合はデフォルトで展開されており、号車の入力欄が見える', () => {
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={vi.fn()}
          onMoveCarEdge={vi.fn()}
          onSave={vi.fn()}
          onDiscard={vi.fn()}
          saving={false}
          isNew
        />
      </MantineProvider>,
    );
    expect(screen.getByLabelText('1号車と2号車の境界')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '折りたたむ' })).toBeInTheDocument();
  });

  it('デフォルトでは折りたたまれており、号車の入力欄が見えない', () => {
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={vi.fn()}
          onMoveCarEdge={vi.fn()}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    expect(screen.queryByLabelText('1号車と2号車の境界')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展開する' })).toBeInTheDocument();
  });

  it('シェブロンをクリックすると号車の入力欄が現れ、ボタン名が「折りたたむ」に変わる', async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={vi.fn()}
          onMoveCarEdge={vi.fn()}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    await user.click(screen.getByRole('button', { name: '展開する' }));
    expect(screen.getByLabelText('1号車と2号車の境界')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '折りたたむ' })).toBeInTheDocument();
  });

  it('展開した状態で再度クリックすると入力欄が再び隠れる', async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <StopPatternInspector
          trainLabel="銀座線"
          cars={cars}
          onMoveCarBoundary={vi.fn()}
          onMoveCarEdge={vi.fn()}
          onSave={vi.fn()}
          saving={false}
          isNew={false}
        />
      </MantineProvider>,
    );
    await user.click(screen.getByRole('button', { name: '展開する' }));
    await user.click(screen.getByRole('button', { name: '折りたたむ' }));
    expect(screen.queryByLabelText('1号車と2号車の境界')).not.toBeInTheDocument();
  });
});
