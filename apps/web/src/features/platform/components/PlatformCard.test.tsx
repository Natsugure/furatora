import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformCard } from './PlatformCard';

function renderCard(collapsible = true) {
  return render(
    <PlatformCard
      title="2番線"
      badge={<span>2</span>}
      details={<p>丸ノ内線</p>}
      closedSummary={<p>図はまだありません</p>}
      collapsible={collapsible}
    >
      <p>列車の図</p>
    </PlatformCard>,
  );
}

const headerButton = () => screen.getByRole('button', { name: '2番線' });

// setup.ts の代用は matches: false（lg 未満）を返す。lg 以上を試すときだけ差し替える
const mobileMatchMedia = window.matchMedia;
function emulateDesktop() {
  window.matchMedia = (query: string) => ({ ...mobileMatchMedia(query), matches: true });
}
afterEach(() => {
  window.matchMedia = mobileMatchMedia;
});

describe('PlatformCard', () => {
  it('既定では閉じている', () => {
    renderCard();
    expect(headerButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('頭を押すと開き、ボタンが中身の要素を指す', async () => {
    renderCard();
    await userEvent.click(headerButton());

    expect(headerButton()).toHaveAttribute('aria-expanded', 'true');
    const content = document.getElementById(headerButton().getAttribute('aria-controls') ?? '');
    expect(content).toContainElement(screen.getByText('列車の図'));
  });

  it('下の端の「閉じる」で閉じ、頭のボタンにフォーカスが移る', async () => {
    renderCard();
    await userEvent.click(headerButton());
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(headerButton()).toHaveAttribute('aria-expanded', 'false');
    expect(headerButton()).toHaveFocus();
  });

  it('閉じている間は「閉じる」を出さない', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: '閉じる' })).not.toBeInTheDocument();
  });

  it('頭の詳しい行は、開け閉めボタンの外にも出ている', () => {
    renderCard();
    expect(screen.getByText('丸ノ内線')).toBeInTheDocument();
    expect(headerButton()).not.toContainElement(screen.getByText('丸ノ内線'));
  });

  it('collapsible でなければ、頭はボタンでなく、中身も出さない', () => {
    renderCard(false);
    expect(screen.getByRole('heading', { name: '2番線' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('列車の図')).not.toBeInTheDocument();
  });

  it('閉じている間は、頭に閉じたときだけの一言を出す', () => {
    renderCard();
    expect(screen.getByText('図はまだありません')).toBeInTheDocument();
  });

  it('開くと、閉じたときだけの一言を頭から外す', async () => {
    renderCard();
    await userEvent.click(headerButton());
    expect(screen.queryByText('図はまだありません')).not.toBeInTheDocument();
  });

  it('collapsible でなければ、閉じたときだけの一言をいつも出す', () => {
    renderCard(false);
    expect(screen.getByText('図はまだありません')).toBeInTheDocument();
  });

  it('lg 以上では、頭はボタンでなく、中身はいつも描く', () => {
    emulateDesktop();
    renderCard();

    expect(screen.getByRole('heading', { name: '2番線' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('列車の図')).toBeInTheDocument();
  });
});
