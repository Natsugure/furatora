// StationListToolbar.test.tsx と同じ理由で fireEvent + fake timers を使う。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { LineListToolbar } from './LineListToolbar';
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

const current: ListHrefState = { operatorId: '', q: '', sort: 'displayOrder', order: 'asc' };

describe('LineListToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('入力すると400ms後に一度だけURLへ反映される', () => {
    renderWithMantine(
      <LineListToolbar current={current} operatorId="" q="" operators={[]} />,
    );
    const input = screen.getByLabelText('検索');

    fireEvent.change(input, { target: { value: '山手線' } });
    act(() => { vi.advanceTimersByTime(400); });

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace.mock.calls[0]![0]).toContain('/lines?');
  });

  it('外部由来のq変更（戻る/進む相当）が入力欄に反映される', () => {
    const { rerender } = renderWithMantine(
      <LineListToolbar current={current} operatorId="" q="" operators={[]} />,
    );
    const input = screen.getByLabelText('検索') as HTMLInputElement;

    rerender(
      <MantineProvider>
        <LineListToolbar current={{ ...current, q: '中央線' }} operatorId="" q="中央線" operators={[]} />
      </MantineProvider>,
    );

    expect(input.value).toBe('中央線');
  });
});
