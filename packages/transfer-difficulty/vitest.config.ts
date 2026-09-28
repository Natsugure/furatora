import { defineConfig } from 'vitest/config';

// domain/ の純関数のみをテストする。DOM を必要としないため node 環境で足りる。
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**'],
  },
});
