export const CITIES = ['台北', '新北', '基隆', '桃園', '台中'] as const;
export type City = (typeof CITIES)[number];

export interface ParkingLot {
  city: City;
  id: string;
  name: string;
  address?: string;
  totalSpaces?: number;
  lat?: number;
  lng?: number;
}

export interface Availability {
  city: City;
  id: string;
  availableSpaces: number;
  updatedAt: Date;
}

export interface LotView extends ParkingLot {
  availability?: Availability;
  fetchError?: string;
}

export interface CityAdapter {
  city: City;
  fetchCatalog(): Promise<ParkingLot[]>;
  fetchAvailability(lotIds?: string[]): Promise<Availability[]>;
}

export class AdapterError extends Error {
  public readonly city: City;
  public readonly cause?: unknown;

  constructor(city: City, message: string, cause?: unknown) {
    super(`[${city}] ${message}`);
    this.name = 'AdapterError';
    this.city = city;
    this.cause = cause;
  }
}
