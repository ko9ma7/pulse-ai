import type { RadarData } from '../types';

export async function loadRadarData(): Promise<RadarData> {
  const url = new URL('data/repositories.json', window.location.href.replace(/#.*$/, ''));
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Radar data request failed: ${response.status}`);
  return response.json() as Promise<RadarData>;
}
