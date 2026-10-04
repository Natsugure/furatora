// 共有する語彙の唯一の入口（@furatora/database/enums。ADR-0015 決定3）。
// 配下は Drizzle にも実行時の外部パッケージにも依存させない（eslint.config.mjs で守っている）
export * from './stationMaster';
export * from './facility';
