// userEvent は IME (composition) を再現できず、fake timers との相性も悪いため、
// このファイルでは fireEvent + vi.useFakeTimers() で決定的に操作する
// （慣習からの意図的な逸脱。他のツールバー系以外のテストは userEvent を使い続けてよい）。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { StationListToolbar } from './StationListToolbar';
import type { ListHrefState } from '@/shared/list/href';

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const current: ListHrefState = {
  operatorId: '', lineId: '', q: '', sort: 'line', order: 'asc', page: 1,
};
const defaults: ListHrefState = { sort: 'line', order: 'asc', page: 1 };

describe('StationListToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('入力すると400ms後に一度だけURLへ反映される', () => {
    renderWithMantine(
      <StationListToolbar
        current={current} defaults={defaults} operatorId="" lineId="" q=""
        operators={[]} lines={[]}
      />,
    );
    const input = screen.getByLabelText('検索');

    fireEvent.change(input, { target: { value: '東京' } });
    act(() => { vi.advanceTimersByTime(400); });

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('q=%E6%9D%B1%E4%BA%AC'));
  });

  it('回帰: URL反映が遅れて古いqが返ってきても、その間に打った文字が消えない', () => {
    const { rerender } = renderWithMantine(
      <StationListToolbar
        current={current} defaults={defaults} operatorId="" lineId="" q=""
        operators={[]} lines={[]}
      />,
    );
    const input = screen.getByLabelText('検索') as HTMLInputElement;

    // 「とう」と入力 → デバウンスが発火して replace が呼ばれる
    fireEvent.change(input, { target: { value: 'とう' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(mockReplace).toHaveBeenCalledTimes(1);

    // サーバー往復が完了する前に、ユーザーがさらに入力を続ける
    fireEvent.change(input, { target: { value: 'とうきょう' } });

    // ここで遅れて古い q="とう" を積んだ再レンダーが RSC から返ってくる想定
    rerender(
      <MantineProvider>
        <StationListToolbar
          current={{ ...current, q: 'とう' }} defaults={defaults} operatorId="" lineId="" q="とう"
          operators={[]} lines={[]}
        />
      </MantineProvider>,
    );

    // 打った文字が巻き戻っていないこと
    expect(input.value).toBe('とうきょう');
  });

  it('回帰: IME変換中はURLへ反映されず、確定後に一度だけ反映される', () => {
    renderWithMantine(
      <StationListToolbar
        current={current} defaults={defaults} operatorId="" lineId="" q=""
        operators={[]} lines={[]}
      />,
    );
    const input = screen.getByLabelText('検索');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'とうきょう' } });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(mockReplace).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { target: { value: 'とうきょう' } });
    act(() => { vi.advanceTimersByTime(400); });

    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('自分の入力以外の経路でqが変わったとき（戻る/進む相当）は入力欄に反映される', () => {
    const { rerender } = renderWithMantine(
      <StationListToolbar
        current={current} defaults={defaults} operatorId="" lineId="" q=""
        operators={[]} lines={[]}
      />,
    );
    const input = screen.getByLabelText('検索') as HTMLInputElement;

    rerender(
      <MantineProvider>
        <StationListToolbar
          current={{ ...current, q: '渋谷' }} defaults={defaults} operatorId="" lineId="" q="渋谷"
          operators={[]} lines={[]}
        />
      </MantineProvider>,
    );

    expect(input.value).toBe('渋谷');
  });
});
