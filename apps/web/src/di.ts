// コンポジションルート。DIライブラリは使わず手動配線する（ADR-0002）。
import { dbStationDetailQuery } from '@/external/query/stationDetailQuery';
import { makeGetStationDetail } from '@/features/station/usecases/getStationDetail';

export const getStationDetail = makeGetStationDetail({ query: dbStationDetailQuery });
