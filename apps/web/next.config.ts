import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // next dev が AGENTS.md を作って書き換えないようにする。エージェントへの指示は CLAUDE.md で管理する
  agentRules: false,
};

export default nextConfig;
