import '@testing-library/jest-dom';

// Route Handler のテストは `@vitest-environment node` で走るため window が無い。
// setupFiles は環境に関わらず全テストに適用されるので、ここで分岐する
if (typeof window !== 'undefined') {
  // Mantine uses window.matchMedia for color scheme detection
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
