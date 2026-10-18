import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackButton } from './BackButton';

const back = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ back }) }));

describe('BackButton', () => {
  it('文字が無くても「戻る」という名前のボタンとして読み上げられる', () => {
    render(<BackButton />);
    expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument();
  });

  it('押すと前の画面に戻る', async () => {
    render(<BackButton />);
    await userEvent.click(screen.getByRole('button', { name: '戻る' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('行き先を渡すと、「戻る」という名前のその行き先へのリンクになる', () => {
    render(<BackButton href="/" />);
    expect(screen.getByRole('link', { name: '戻る' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
