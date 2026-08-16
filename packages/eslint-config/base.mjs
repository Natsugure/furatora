import { globalIgnores } from 'eslint/config';

export default [
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
];
