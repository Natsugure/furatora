// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from './route';

const update = vi.fn();

vi.mock('@/di', () => ({
  platformLocationRepository: {
    update: (...args: unknown[]) => update(...args),
  },
}));

const STATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440001';
const PLATFORM_ID = '550e8400-e29b-41d4-a716-446655440002';
const params = { params: Promise.resolve({ stationId: STATION_ID, locationId: LOCATION_ID }) };

function request(body: string) {
  return new Request(`http://localhost/api/stations/${STATION_ID}/platform-locations/${LOCATION_ID}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PUT /api/stations/[stationId]/platform-locations/[locationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('車いす対応・ベビーカー対応・設備メモを送られても Repository に渡さない（#217 で廃止した項目。旧クライアントからの送信を受け付ける）', async () => {
    update.mockResolvedValue({ id: LOCATION_ID });

    const response = await PUT(
      request(JSON.stringify({
        platformId: PLATFORM_ID,
        cells: [{
          xPositionMeters: 10,
          facilities: [{ typeCode: 'elevator', isWheelchairAccessible: false, isStrollerAccessible: false, notes: 'メモ' }],
        }],
      })),
      params,
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(LOCATION_ID, STATION_ID, expect.objectContaining({
      cells: [{ xPositionMeters: 10, facilities: [{ typeCode: 'elevator' }] }],
    }));
  });
});
