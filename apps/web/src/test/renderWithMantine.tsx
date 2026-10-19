import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { render, type RenderResult } from '@testing-library/react';
import { mantineTheme } from '@/theme/mantineTheme';

// Mantine の部品（SegmentedControl など）は MantineProvider の中でしか描けない。
// アプリと同じ theme で包み、theme に置いた共通の見た目も描く
function Wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider theme={mantineTheme}>{children}</MantineProvider>;
}

export const renderWithMantine = (ui: ReactNode): RenderResult => render(ui, { wrapper: Wrapper });
