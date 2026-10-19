'use client';

import { MantineProvider } from '@mantine/core';
import { mantineTheme } from '@/theme/mantineTheme';

export function Providers({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={mantineTheme}>{children}</MantineProvider>;
}
