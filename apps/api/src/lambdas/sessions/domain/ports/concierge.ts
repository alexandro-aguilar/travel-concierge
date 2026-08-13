import type {
  EventOption,
  FlightOption,
  HotelOption,
  ModelDecision,
  PartialRequirements,
  TripRequirements,
  WeatherOption,
  ProviderOutcome,
  Recommendation,
} from '../models/concierge.js';
export interface ConciergeModel {
  decide(message: string, previous: PartialRequirements): Promise<ModelDecision>;
  explain(recommendation: Recommendation): Promise<string>;
}
export interface FlightSearch {
  search(requirements: TripRequirements): Promise<ProviderOutcome<FlightOption>>;
}
export interface HotelSearch {
  search(requirements: TripRequirements): Promise<ProviderOutcome<HotelOption>>;
}
export interface EventSearch {
  search(requirements: TripRequirements): Promise<ProviderOutcome<EventOption>>;
}
export interface WeatherSearch {
  search(requirements: TripRequirements): Promise<ProviderOutcome<WeatherOption>>;
}
