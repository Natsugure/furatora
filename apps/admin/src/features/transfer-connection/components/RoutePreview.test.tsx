import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { RoutePreview } from './RoutePreview';

const renderPreview = (facilities: Parameters<typeof RoutePreview>[0]['facilities']) =>
  render(
    <MantineProvider>
      <RoutePreview facilities={facilities} />
    </MantineProvider>,
  );

describe('RoutePreview', () => {
  it('エレベーターだけのルートは、両ペルソナがそのまま通れて、バリアフリールートと示す', () => {
    renderPreview(['elevator']);
    expect(screen.getByText('ベビーカー: そのまま通れる')).toBeInTheDocument();
    expect(screen.getByText('車いす: そのまま通れる')).toBeInTheDocument();
    expect(screen.getAllByText('バリアフリールート')).toHaveLength(2);
  });

  it('階段昇降機を含むルートは、ベビーカーは通れず（バリアフリーではない）、車いすは係員を呼ぶ（バリアフリー）', () => {
    renderPreview(['elevator', 'stairLift']);
    expect(screen.getByText('ベビーカー: 通れない')).toBeInTheDocument();
    expect(screen.getByText('車いす: 係員を呼ぶ')).toBeInTheDocument();
    expect(screen.getAllByText('バリアフリールート')).toHaveLength(1);
  });

  it('階段を含むルートは、バリアフリールートではない', () => {
    renderPreview(['stairs']);
    expect(screen.getByText('ベビーカー: 持ち上げる')).toBeInTheDocument();
    expect(screen.getByText('車いす: 駅員複数名の介助')).toBeInTheDocument();
    expect(screen.queryByText('バリアフリールート')).not.toBeInTheDocument();
  });

  it('設備0件は「設備が未入力」と示し、必要な行為を導出せず、バリアフリールートにも数えない（ADR-0012）', () => {
    renderPreview([]);
    expect(screen.getByText(/設備が未入力/)).toBeInTheDocument();
    expect(screen.queryByText(/そのまま通れる/)).not.toBeInTheDocument();
    expect(screen.queryByText('バリアフリールート')).not.toBeInTheDocument();
  });
});
