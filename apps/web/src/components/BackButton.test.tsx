import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BackButton } from './BackButton';

const back = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ back }) }));

// jsdom には Navigation API が無い。履歴の有無を差し替えて確かめる
function stubNavigation(navigation: { canGoBack: boolean } | undefined) {
  Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });
}

describe('BackButton', () => {
  beforeEach(() => back.mockClear());
  afterEach(() => stubNavigation(undefined));

  it('文字が無くても「戻る」という名前の、行き先へのリンクとして読み上げられる', () => {
    render(<BackButton href="/" />);
    expect(screen.getByRole('link', { name: '戻る' })).toHaveAttribute('href', '/');
  });

  it('アプリ内の履歴があれば、リンク先へは行かず前の画面に戻る', () => {
    stubNavigation({ canGoBack: true });
    render(<BackButton href="/" />);
    // fireEvent は既定の動作を止めると false を返す
    expect(fireEvent.click(screen.getByRole('link', { name: '戻る' }))).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['履歴が無い', { canGoBack: false }],
    ['Navigation API の無いブラウザ', undefined],
  ])('%s ときは、前の画面に戻らずリンク先へ行く', (_, navigation) => {
    stubNavigation(navigation);
    render(<BackButton href="/" />);
    fireEvent.click(screen.getByRole('link', { name: '戻る' }));
    expect(back).not.toHaveBeenCalled();
  });
});
