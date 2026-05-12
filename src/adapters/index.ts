import { adapter as taipei } from './taipei.js';
import { adapter as ntpc } from './ntpc.js';
import { adapter as keelung } from './keelung.js';
import { adapter as taoyuan } from './taoyuan.js';
import { adapter as taichung } from './taichung.js';
import { CITIES, type City, type CityAdapter } from './types.js';

export const CITY_ADAPTERS: Record<City, CityAdapter> = {
  台北: taipei,
  新北: ntpc,
  基隆: keelung,
  桃園: taoyuan,
  台中: taichung,
};

export function getAdapter(city: City): CityAdapter {
  return CITY_ADAPTERS[city];
}

export { CITIES };
export type { City, CityAdapter };
