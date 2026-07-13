
export enum Direction {
  N = 'N',
  S = 'S',
  E = 'E',
  W = 'W'
}

export enum TrafficSide {
  NS = 'NORTH_SOUTH',
  EW = 'EAST_WEST'
}

export enum Phase {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED'
}

export interface Vehicle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  dir: Direction;
  type: 'sedan' | 'truck';
  length: number;
  maxSpeed: number;
  currentSpeed: number;
  passed: boolean;
  waiting: number;
  color: string;
  isStopping?: boolean;
}

export interface WeatherConfig {
  name: string;
  speed: number;
  yellow: number;
  bg: string;
  factor: number;
}

export interface Metrics {
  totalEmissions: number;
  vehiclesPassed: number;
  episodeReward: number;
  avgLoss: number;
  epsilon: number;
  episodes: number;
  rewardHistory: number[];
}

export interface AIDecision {
  action: string;
  qValues: number[];
  confidence: string;
}
