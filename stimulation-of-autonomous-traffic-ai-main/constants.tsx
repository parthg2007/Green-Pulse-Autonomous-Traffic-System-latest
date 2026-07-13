
import React from 'react';
import { WeatherConfig } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const ROAD_WIDTH = 140;
export const CAR_WIDTH = 48;
export const CAR_HEIGHT = 28;
export const TRUCK_WIDTH = 72;

export const ACTIONS = ['SWITCH', 'EXTEND_5S', 'EXTEND_10S'];
export const STATE_SIZE = 12;
export const LEARNING_RATE = 0.0005;
export const GAMMA = 0.95;
export const MEMORY_SIZE = 2000;
export const BATCH_SIZE = 64;
export const INITIAL_EPSILON = 1.0;
export const EPSILON_DECAY = 0.9995;
export const EPSILON_MIN = 0.01;
export const TARGET_UPDATE_FREQ = 100;

export const MIN_GREEN_TIME = 5;
export const MAX_GREEN_TIME = 60;
export const YELLOW_TIME = 3;

export const REWARDS = {
  VEHICLE_PASSED: 10,
  IDLE_PENALTY: -2.5,
  QUEUE_PENALTY: -1.0,
  WAIT_TIME_PENALTY: -0.1,
  SWITCH_PENALTY: -5.0,
  EMISSION_PENALTY: -0.01,
};

export const CO2 = {
  IDLE: 0.5,
  ACCEL: 1.0,
  RUNNING: 0.1,
  TRUCK_MULT: 2.0,
};

export const ACCELERATION = 0.08;
export const BRAKING_FORCE = 0.2;
export const STOP_THRESHOLD = 0.1;

export const WEATHER: Record<string, WeatherConfig> = {
  SUNNY: { name: 'Clear', speed: 3.8, yellow: 3, bg: '#ecfdf5', factor: 1.0 },
  RAIN: { name: 'Rain', speed: 2.6, yellow: 5, bg: '#e2e8f0', factor: 0.7 },
  FOG: { name: 'Fog', speed: 2.0, yellow: 6, bg: '#e4e4e7', factor: 0.5 }
};

export const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

export const CloudRainIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
  </svg>
);

export const CloudFogIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.5 21H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /><path d="M22 10H2M22 14H2" />
  </svg>
);

export const BrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M12 5v13M10 18h4" />
  </svg>
);

export const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

export const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

export const RefreshIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
  </svg>
);

export const NavigationIcon = ({ rotate }: { rotate?: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ transform: rotate ? 'rotate(90deg)' : 'none' }}>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);
