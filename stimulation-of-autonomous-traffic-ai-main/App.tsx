
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Direction, TrafficSide, Phase, Vehicle, Metrics, AIDecision
} from './types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, ROAD_WIDTH, CAR_WIDTH, CAR_HEIGHT,
  MIN_GREEN_TIME, MAX_GREEN_TIME, YELLOW_TIME, ACTIONS, INITIAL_EPSILON,
  REWARDS, CO2, STOP_THRESHOLD, ACCELERATION, BRAKING_FORCE, TRUCK_WIDTH,
  WEATHER, SunIcon, CloudRainIcon, CloudFogIcon, BrainIcon, PlayIcon,
  PauseIcon, RefreshIcon, NavigationIcon, GAMMA
} from './constants';
import { DQNAgent } from './services/dqnAgent';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- Utility Helpers ---
const normalizeValue = (value: number, max: number) => Math.min(Math.max(value / max, 0), 1);

// --- Sub-Components ---
const EcoTree = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    <path d="M0 0 L-10 15 L10 15 Z" fill="#064e3b" />
    <path d="M0 -10 L-8 5 L8 5 Z" fill="#059669" />
    <rect x="-2" y="15" width="4" height="6" fill="#4b2e1e" />
  </g>
);

const MetricCard = ({ label, value, colorClass = 'text-indigo-400' }: { label: string; value: string | number; colorClass?: string }) => (
  <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 backdrop-blur-sm">
    <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-xl font-mono font-bold ${colorClass}`}>{value}</div>
  </div>
);

const TrafficLightDisplay = ({ side, activeSide, phase, timer }: { side: TrafficSide; activeSide: TrafficSide; phase: Phase; timer: number }) => {
  const isActive = activeSide === side;
  const directionName = side === TrafficSide.NS ? 'North-South' : 'East-West';

  return (
    <div className={`p-2 px-4 sm:p-4 sm:px-8 rounded-xl border transition-all duration-700 ${isActive ? 'border-indigo-500/50 bg-indigo-500/10 scale-105 opacity-100' : 'border-zinc-800/50 bg-zinc-900/30 opacity-40 grayscale-[0.5]'
      } backdrop-blur-md`}>
      <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
        <NavigationIcon rotate={side === TrafficSide.EW} />
        <div className="text-[8px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{directionName}</div>
      </div>
      <div className={`text-2xl sm:text-4xl font-mono font-black text-center ${isActive ? 'text-white' : 'text-zinc-800'}`}>
        {isActive ? Math.max(0, timer).toString().padStart(2, '0') : '--'}
      </div>
      <div className="flex justify-center gap-2 mt-2 sm:mt-4">
        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isActive && phase === Phase.GREEN ? 'bg-emerald-400 shadow-[0_0_15px_#10b981]' : 'bg-zinc-800'}`} />
        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isActive && phase === Phase.YELLOW ? 'bg-amber-400 shadow-[0_0_15px_#f59e0b]' : 'bg-zinc-800'}`} />
        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${!isActive ? 'bg-rose-500 shadow-[0_0_15px_#ef4444]' : 'bg-zinc-800'}`} />
      </div>
    </div>
  );
};

// --- Main App ---
const App: React.FC = () => {
  // --- Refs for Performance and State Stability ---
  // Fix: Added null as initial value to resolve "Expected 1 arguments, but got 0" error
  const requestRef = useRef<number | null>(null);
  const agentRef = useRef<DQNAgent | null>(null);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const timerRef = useRef<number>(MIN_GREEN_TIME);
  const phaseRef = useRef<Phase>(Phase.GREEN);
  const activeSideRef = useRef<TrafficSide>(TrafficSide.NS);
  const isPausedRef = useRef<boolean>(false);
  const statsRef = useRef<Record<Direction, number>>({ N: 0, S: 0, E: 0, W: 0 });
  const metricsInternalRef = useRef({
    episodeReward: 0, lastState: null as number[] | null, lastAction: null as number | null,
    stepCount: 0, vehiclePassedIds: new Set<string>(), stepEmissions: 0, lastEmissionUpdate: Date.now()
  });

  // --- React State ---
  const [timer, setTimer] = useState(MIN_GREEN_TIME);
  const [phase, setPhase] = useState<Phase>(Phase.GREEN);
  const [activeSide, setActiveSide] = useState<TrafficSide>(TrafficSide.NS);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [weatherMode, setWeatherMode] = useState<string>('SUNNY');
  const [autoSpawn, setAutoSpawn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);
  const [stats, setStats] = useState<Record<Direction, number>>({ N: 0, S: 0, E: 0, W: 0 });
  const [metrics, setMetrics] = useState<Metrics>({
    totalEmissions: 0, vehiclesPassed: 0, episodeReward: 0,
    avgLoss: 0, epsilon: INITIAL_EPSILON, episodes: 0, rewardHistory: [],
  });
  const [aiDecision, setAiDecision] = useState<AIDecision>({
    action: 'Initializing...', qValues: [0, 0, 0], confidence: '0',
  });

  // --- Sync State with Refs ---
  useEffect(() => { timerRef.current = timer; }, [timer]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { activeSideRef.current = activeSide; }, [activeSide]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  // --- Initialization ---
  useEffect(() => {
    agentRef.current = new DQNAgent();
    return () => agentRef.current?.dispose();
  }, []);

  // Update stats ref when vehicles change
  useEffect(() => {
    vehiclesRef.current = vehicles;
    const counts = { N: 0, S: 0, E: 0, W: 0 };
    vehicles.forEach(v => { if (!v.passed) counts[v.dir]++; });
    setStats(counts);
  }, [vehicles]);

  // Static tree positions for the background
  const treePositions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < 20; i++) {
      let tx, ty;
      do {
        tx = Math.random() * CANVAS_WIDTH;
        ty = Math.random() * CANVAS_HEIGHT;
      } while (Math.abs(tx - CANVAS_WIDTH / 2) < 95 || Math.abs(ty - CANVAS_HEIGHT / 2) < 95);
      pos.push({ x: tx, y: ty, scale: 0.6 + Math.random() * 0.7 });
    }
    return pos;
  }, []);

  // --- AI Perception & Logic ---
  const getEnhancedState = useCallback(() => {
    const v = vehiclesRef.current;
    const queues = { N: 0, S: 0, E: 0, W: 0 };
    const stopped = { N: 0, S: 0, E: 0, W: 0 };
    let avgSpeed = 0, maxWait = 0;

    v.forEach(veh => {
      if (!veh.passed) {
        queues[veh.dir]++;
        avgSpeed += veh.currentSpeed || 0;
        if ((veh.currentSpeed || 0) < STOP_THRESHOLD) stopped[veh.dir]++;
        maxWait = Math.max(maxWait, veh.waiting || 0);
      }
    });

    avgSpeed /= v.length || 1;
    const nsQueue = queues.N + queues.S;
    const ewQueue = queues.E + queues.W;

    return [
      normalizeValue(nsQueue, 20), normalizeValue(ewQueue, 20),
      normalizeValue(stopped.N + stopped.S, 20), normalizeValue(stopped.E + stopped.W, 20),
      activeSideRef.current === TrafficSide.NS ? 1 : 0,
      phaseRef.current === Phase.GREEN ? 1 : phaseRef.current === Phase.YELLOW ? 0.5 : 0,
      normalizeValue(timerRef.current, MAX_GREEN_TIME), normalizeValue(avgSpeed, 5),
      WEATHER[weatherMode].factor, normalizeValue(maxWait, 100),
      normalizeValue(Math.abs(nsQueue - ewQueue), 20),
      normalizeValue(Object.values(stopped).reduce((a, b) => a + b, 0), 40),
    ];
  }, [weatherMode]);

  const calculateReward = useCallback(() => {
    const v = vehiclesRef.current;
    let reward = 0;

    v.forEach(vehicle => {
      if (vehicle.passed && !metricsInternalRef.current.vehiclePassedIds.has(vehicle.id)) {
        reward += REWARDS.VEHICLE_PASSED;
        metricsInternalRef.current.vehiclePassedIds.add(vehicle.id);
      }
    });

    const totalQueue = Object.values(statsRef.current).reduce((a, b) => a + b, 0);
    reward += REWARDS.QUEUE_PENALTY * totalQueue;
    reward += REWARDS.EMISSION_PENALTY * metricsInternalRef.current.stepEmissions;

    return reward;
  }, []);

  const handleTimerExpired = useCallback(async () => {
    if (!agentRef.current || agentRef.current.isDisposed) return;

    const currentPhase = phaseRef.current;
    const currentActiveSide = activeSideRef.current;
    const currentState = getEnhancedState();
    const reward = calculateReward();
    metricsInternalRef.current.episodeReward += reward;

    // Learning Phase
    if (metricsInternalRef.current.lastState && metricsInternalRef.current.lastAction !== null) {
      const done = metricsInternalRef.current.stepCount >= 100;
      agentRef.current.remember(metricsInternalRef.current.lastState, metricsInternalRef.current.lastAction, reward, currentState, done);
      await agentRef.current.replay();

      if (done) {
        const episodeReward = metricsInternalRef.current.episodeReward;
        setMetrics(prev => ({
          ...prev,
          episodes: prev.episodes + 1,
          rewardHistory: [...prev.rewardHistory.slice(-49), episodeReward],
        }));

        metricsInternalRef.current.episodeReward = 0;
        metricsInternalRef.current.stepCount = 0;
        metricsInternalRef.current.vehiclePassedIds.clear();
      }
    }

    // AI Action Selection
    const actionIndex = currentPhase === Phase.GREEN ? agentRef.current.act(currentState) : 0;
    const qValues = agentRef.current.getQValues(currentState);

    let nextDuration = MIN_GREEN_TIME, nextPhase = currentPhase, nextSide = currentActiveSide;

    if (currentPhase === Phase.GREEN) {
      if (actionIndex === 0) { nextPhase = Phase.YELLOW; nextDuration = YELLOW_TIME; }
      else if (actionIndex === 1) { nextPhase = Phase.GREEN; nextDuration = 5; }
      else { nextPhase = Phase.GREEN; nextDuration = 10; }
    } else if (currentPhase === Phase.YELLOW) {
      nextPhase = Phase.GREEN;
      nextSide = currentActiveSide === TrafficSide.NS ? TrafficSide.EW : TrafficSide.NS;
      nextDuration = MIN_GREEN_TIME;
    }

    // Commit results to refs and state
    phaseRef.current = nextPhase;
    activeSideRef.current = nextSide;
    timerRef.current = nextDuration;
    metricsInternalRef.current.lastState = currentState;
    metricsInternalRef.current.lastAction = actionIndex;
    metricsInternalRef.current.stepCount++;
    metricsInternalRef.current.stepEmissions = 0;

    setPhase(nextPhase);
    setActiveSide(nextSide);
    setTimer(nextDuration);
    setSimulationStep(prev => prev + 1);

    setAiDecision({
      action: ACTIONS[actionIndex], qValues: qValues,
      confidence: ((1 - agentRef.current.epsilon) * 100).toFixed(0),
    });

    setMetrics(prev => ({
      ...prev, epsilon: agentRef.current?.epsilon || 0,
      avgLoss: agentRef.current?.getAverageLoss() || 0,
      episodeReward: metricsInternalRef.current.episodeReward,
    }));
  }, [getEnhancedState, calculateReward]);

  // --- Real-time Systems ---
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      if (timerRef.current <= 1) {
        handleTimerExpired();
      } else {
        const nextTime = timerRef.current - 1;
        timerRef.current = nextTime;
        setTimer(nextTime);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, handleTimerExpired]);

  const spawn = useCallback((dir: Direction) => {
    let x, y, vx, vy, angle;
    switch (dir) {
      case Direction.N: x = CANVAS_WIDTH / 2 - 35; y = -100; vx = 0; vy = 1; angle = 90; break;
      case Direction.S: x = CANVAS_WIDTH / 2 + 35; y = CANVAS_HEIGHT + 100; vx = 0; vy = -1; angle = 270; break;
      case Direction.E: x = -100; y = CANVAS_HEIGHT / 2 + 35; vx = 1; vy = 0; angle = 0; break;
      case Direction.W: x = CANVAS_WIDTH + 100; y = CANVAS_HEIGHT / 2 - 35; vx = -1; vy = 0; angle = 180; break;
      default: return;
    }

    if (vehiclesRef.current.some(v => Math.abs(v.x - x) < 100 && Math.abs(v.y - y) < 100)) return;

    const type = Math.random() > 0.85 ? 'truck' : 'sedan';
    const id = Math.random().toString(36).substring(2, 11);

    setVehicles(prev => [...prev, {
      id, x, y, vx, vy, angle, dir, type,
      length: type === 'truck' ? TRUCK_WIDTH : CAR_WIDTH,
      maxSpeed: WEATHER[weatherMode].speed * (0.8 + Math.random() * 0.4),
      currentSpeed: 0, passed: false, waiting: 0,
      color: type === 'truck' ? '#475569' : `hsl(${Math.random() * 360}, 50%, 45%)`
    }]);
  }, [weatherMode]);

  useEffect(() => {
    if (!autoSpawn || isPaused) return;
    const interval = setInterval(() => {
      const dirs = [Direction.N, Direction.S, Direction.E, Direction.W];
      spawn(dirs[Math.floor(Math.random() * dirs.length)]);
    }, 1400);
    return () => clearInterval(interval);
  }, [autoSpawn, spawn, isPaused]);

  const animate = useCallback(() => {
    if (isPausedRef.current) {
      if (requestRef.current !== null) {
        requestRef.current = requestAnimationFrame(animate);
      }
      return;
    }

    const now = Date.now();
    const deltaTime = Math.min((now - metricsInternalRef.current.lastEmissionUpdate) / 1000, 0.1);
    metricsInternalRef.current.lastEmissionUpdate = now;

    let frameEmissions = 0;
    const currentActiveSide = activeSideRef.current;
    const currentPhase = phaseRef.current;

    setVehicles(prevVehicles => {
      const updatedVehicles = prevVehicles.map(v => {
        const isGreenSide = (currentActiveSide === TrafficSide.NS && (v.dir === Direction.N || v.dir === Direction.S)) ||
          (currentActiveSide === TrafficSide.EW && (v.dir === Direction.E || v.dir === Direction.W));

        const stopLineOffset = 160;
        const inZone = (
          (v.dir === Direction.N && v.y > CANVAS_HEIGHT / 2 - stopLineOffset && v.y < CANVAS_HEIGHT / 2 - 80) ||
          (v.dir === Direction.S && v.y < CANVAS_HEIGHT / 2 + stopLineOffset && v.y > CANVAS_HEIGHT / 2 + 80) ||
          (v.dir === Direction.E && v.x > CANVAS_WIDTH / 2 - stopLineOffset && v.x < CANVAS_WIDTH / 2 - 80) ||
          (v.dir === Direction.W && v.x < CANVAS_WIDTH / 2 + stopLineOffset && v.x > CANVAS_WIDTH / 2 + 80)
        );

        const blocking = prevVehicles.find(o => {
          if (o.id === v.id || o.dir !== v.dir) return false;
          const isAhead = (
            (v.dir === Direction.N && o.y > v.y) || (v.dir === Direction.S && o.y < v.y) ||
            (v.dir === Direction.E && o.x > v.x) || (v.dir === Direction.W && o.x < v.x)
          );
          if (!isAhead) return false;
          const dx = Math.abs(v.x - o.x), dy = Math.abs(v.y - o.y);
          const minGap = (v.type === 'truck' || o.type === 'truck') ? 100 : 75;
          return (v.dir === Direction.N || v.dir === Direction.S) ? dx < 20 && dy < minGap : dy < 20 && dx < minGap;
        });

        const shouldStop = (!v.passed && !isGreenSide && inZone) ||
          (!v.passed && isGreenSide && currentPhase !== Phase.GREEN && inZone) || !!blocking;

        const targetSpeed = shouldStop ? 0 : v.maxSpeed;
        let newSpeed = v.currentSpeed || 0;

        const typeMult = v.type === 'truck' ? CO2.TRUCK_MULT : 1.0;
        let emissionRate = 0;

        if (newSpeed < STOP_THRESHOLD) emissionRate = CO2.IDLE * typeMult;
        else if (newSpeed > (v.currentSpeed || 0) + 0.05) emissionRate = CO2.ACCEL * typeMult;
        else emissionRate = CO2.RUNNING * typeMult;

        frameEmissions += emissionRate * deltaTime;

        if (newSpeed < targetSpeed) newSpeed = Math.min(targetSpeed, newSpeed + ACCELERATION);
        else if (newSpeed > targetSpeed) newSpeed = Math.max(targetSpeed, newSpeed - BRAKING_FORCE);

        let passed = v.passed;
        if (!passed) {
          if ((v.dir === Direction.N && v.y > CANVAS_HEIGHT / 2) || (v.dir === Direction.S && v.y < CANVAS_HEIGHT / 2) ||
            (v.dir === Direction.E && v.x > CANVAS_WIDTH / 2) || (v.dir === Direction.W && v.x < CANVAS_WIDTH / 2)) {
            passed = true;
          }
        }

        return {
          ...v,
          x: v.x + (shouldStop ? 0 : v.vx * newSpeed),
          y: v.y + (shouldStop ? 0 : v.vy * newSpeed),
          passed, currentSpeed: newSpeed, isStopping: shouldStop,
          waiting: shouldStop ? (v.waiting || 0) + deltaTime : 0
        };
      });

      return updatedVehicles.filter(v => {
        const inBounds = v.x > -200 && v.x < CANVAS_WIDTH + 200 && v.y > -200 && v.y < CANVAS_HEIGHT + 200;
        if (!inBounds && v.passed) {
          setMetrics(prev => ({ ...prev, vehiclesPassed: prev.vehiclesPassed + 1 }));
        }
        return inBounds;
      });
    });

    metricsInternalRef.current.stepEmissions += frameEmissions;
    setMetrics(prev => ({ ...prev, totalEmissions: Math.max(0, prev.totalEmissions + frameEmissions) }));

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    metricsInternalRef.current.lastEmissionUpdate = Date.now();
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current !== null) cancelAnimationFrame(requestRef.current); };
  }, [animate]);

  const handleReset = () => {
    timerRef.current = MIN_GREEN_TIME;
    phaseRef.current = Phase.GREEN;
    activeSideRef.current = TrafficSide.NS;
    metricsInternalRef.current = {
      episodeReward: 0, lastState: null, lastAction: null, stepCount: 0,
      vehiclePassedIds: new Set(), stepEmissions: 0, lastEmissionUpdate: Date.now(),
    };
    setTimer(MIN_GREEN_TIME);
    setPhase(Phase.GREEN);
    setActiveSide(TrafficSide.NS);
    setVehicles([]);
    setSimulationStep(0);
    setMetrics({
      totalEmissions: 0, vehiclesPassed: 0, episodeReward: 0,
      avgLoss: 0, epsilon: agentRef.current?.epsilon || INITIAL_EPSILON,
      episodes: 0, rewardHistory: [],
    });
  };

  // --- Chart Data ---
  const rewardData = useMemo(() =>
    metrics.rewardHistory.map((val, i) => ({ episode: i, reward: val })),
    [metrics.rewardHistory]);

  return (
    <div className="flex flex-col h-screen text-zinc-900 transition-colors duration-1000" style={{ backgroundColor: WEATHER[weatherMode].bg }}>
      {/* Header Bar */}
      <header className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex flex-wrap justify-between items-center gap-3 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
            <BrainIcon />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-[0.2em] text-zinc-500 uppercase m-0 leading-tight">Neural Traffic Control AI</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                {isPaused ? 'Simulation Paused' : 'Real-time AI Optimization'} — Step {simulationStep}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-zinc-900 px-4 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-xs">🌿</span>
            <span className="text-[10px] font-black text-zinc-500 uppercase">CO₂:</span>
            <span className="text-xs font-mono font-bold text-white">{metrics.totalEmissions.toFixed(1)}g</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900 px-4 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-xs">🚗</span>
            <span className="text-[10px] font-black text-zinc-500 uppercase">Vehicles:</span>
            <span className="text-xs font-mono font-bold text-white">{metrics.vehiclesPassed}</span>
          </div>

          <button
            onClick={() => setIsPaused(p => !p)}
            className={`px-4 py-1.5 rounded-lg border flex items-center gap-2 text-[10px] font-black uppercase transition-all ${isPaused ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
              }`}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <div className="bg-zinc-900 p-1 rounded-lg flex border border-zinc-800 gap-1">
            {Object.keys(WEATHER).map(key => (
              <button
                key={key}
                onClick={() => setWeatherMode(key)}
                className={`p-1.5 rounded-md transition-all ${weatherMode === key ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {key === 'SUNNY' ? <SunIcon /> : key === 'RAIN' ? <CloudRainIcon /> : <CloudFogIcon />}
              </button>
            ))}
          </div>

          <button
            onClick={handleReset}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-600 rounded-lg transition-all"
          >
            <RefreshIcon />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col xl:flex-row p-4 gap-4 bg-black overflow-y-auto overflow-x-hidden min-h-0">
        {/* Simulation Canvas */}
        <div className="xl:flex-[3] bg-zinc-950 rounded-2xl relative border border-zinc-900 overflow-hidden flex items-center justify-center min-h-[300px] xl:min-h-0">
          {/* HUD Overlay for Lights */}
          <div className="absolute top-4 sm:top-8 left-0 right-0 flex justify-center gap-4 sm:gap-12 z-30 pointer-events-none px-2">
            <TrafficLightDisplay side={TrafficSide.NS} activeSide={activeSide} phase={phase} timer={timer} />
            <TrafficLightDisplay side={TrafficSide.EW} activeSide={activeSide} phase={phase} timer={timer} />
          </div>

          <svg className="w-full h-full" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="asphalt" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="#18181b" />
                <circle cx="10" cy="10" r="1" fill="#27272a" />
              </pattern>
              <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="#064e3b" />
                <path d="M0 40 L5 30 L10 40" fill="#065f46" opacity="0.3" />
              </pattern>
            </defs>

            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grass)" />
            {treePositions.map((pos, i) => <EcoTree key={i} x={pos.x} y={pos.y} scale={pos.scale} />)}

            <rect x="0" y={CANVAS_HEIGHT / 2 - ROAD_WIDTH / 2} width={CANVAS_WIDTH} height={ROAD_WIDTH} fill="url(#asphalt)" />
            <rect x={CANVAS_WIDTH / 2 - ROAD_WIDTH / 2} y="0" width={ROAD_WIDTH} height={CANVAS_HEIGHT} fill="url(#asphalt)" />
            <rect x={CANVAS_WIDTH / 2 - ROAD_WIDTH / 2} y={CANVAS_HEIGHT / 2 - ROAD_WIDTH / 2} width={ROAD_WIDTH} height={ROAD_WIDTH} fill="#27272a" />

            <line x1="0" y1={CANVAS_HEIGHT / 2} x2={CANVAS_WIDTH} y2={CANVAS_HEIGHT / 2} stroke="#fbbf24" strokeWidth="2" strokeDasharray="30,20" opacity="0.3" />
            <line x1={CANVAS_WIDTH / 2} y1="0" x2={CANVAS_WIDTH / 2} y2={CANVAS_HEIGHT} stroke="#fbbf24" strokeWidth="2" strokeDasharray="30,20" opacity="0.3" />

            {[0, 90, 180, 270].map(rot => (
              <g key={rot} transform={`translate(${CANVAS_WIDTH / 2}, ${CANVAS_HEIGHT / 2}) rotate(${rot})`}>
                <rect x={-ROAD_WIDTH / 2} y={ROAD_WIDTH / 2 + 5} width={ROAD_WIDTH} height={40} fill="rgba(255,255,255,0.02)" />
                {[...Array(6)].map((_, i) => (
                  <rect key={i} x={-ROAD_WIDTH / 2 + 10 + (i * 22)} y={ROAD_WIDTH / 2 + 10} width={12} height={30} fill="white" opacity="0.1" />
                ))}
              </g>
            ))}

            {vehicles.map(v => (
              <g key={v.id} transform={`translate(${v.x}, ${v.y}) rotate(${v.angle})`}>
                <rect
                  x={-v.length / 2}
                  y={-CAR_HEIGHT / 2}
                  width={v.length}
                  height={v.type === 'truck' ? 32 : CAR_HEIGHT}
                  rx="6"
                  fill={v.color}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="1"
                  className="transition-transform duration-200"
                />
                <rect x={v.length / 2 - 20} y={-10} width={10} height={20} fill="rgba(255,255,255,0.2)" rx="2" />
                {v.isStopping && (
                  <g>
                    <circle cx={-v.length / 2 + 5} cy={-10} r="4" fill="#ef4444" className="animate-pulse" />
                    <circle cx={-v.length / 2 + 5} cy={10} r="4" fill="#ef4444" className="animate-pulse" />
                  </g>
                )}
              </g>
            ))}
          </svg>

          {weatherMode !== 'SUNNY' && (
            <div className="absolute inset-0 pointer-events-none bg-blue-900/10 backdrop-blur-[0.5px] transition-all duration-1000 z-10" />
          )}

          {isPaused && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center">
              <div className="bg-zinc-950 p-8 px-12 rounded-2xl border border-zinc-800 text-center shadow-2xl">
                <div className="text-2xl font-black text-white uppercase tracking-widest mb-2">Simulation Paused</div>
                <div className="text-sm text-zinc-500">Global clock frozen. Press resume to continue learning.</div>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Side Panel */}
        <div className="xl:flex-1 flex flex-col gap-4 xl:gap-6 overflow-y-auto pr-1 xl:min-w-[320px] shrink-0">
          {/* Lane Status */}
          <section className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 shadow-xl">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex justify-between">
              <span>📊 Real-time Flow</span>
              <span className="text-zinc-700 font-mono">{vehicles.length} Units</span>
            </h3>
            <div className="space-y-4">
              {([Direction.N, Direction.S, Direction.E, Direction.W]).map((dir) => {
                const count = stats[dir] || 0;
                const isCritical = count > 10;
                const dirNames = { N: 'North', S: 'South', E: 'East', W: 'West' };
                return (
                  <div key={dir}>
                    <div className="flex justify-between mb-1.5 items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-3 rounded-full ${isCritical ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                        <span className="text-[11px] font-black text-zinc-300 uppercase">{dirNames[dir]}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold ${isCritical ? 'text-rose-500' : 'text-zinc-600'}`}>
                        {count.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isCritical ? 'bg-rose-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, count * 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setAutoSpawn(p => !p)}
              className={`w-full mt-8 p-3 rounded-xl border text-[10px] font-black uppercase transition-all tracking-widest ${autoSpawn ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-zinc-600'
                }`}
            >
              Automatic Influx: {autoSpawn ? 'Enabled' : 'Disabled'}
            </button>
          </section>

          {/* AI Decision Model */}
          <section className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 shadow-xl flex-1 flex flex-col">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              🧠 Neural Engine Metrics
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <MetricCard label="Episode Rwd" value={metrics.episodeReward.toFixed(0)} colorClass="text-emerald-400" />
              <MetricCard label="Exploration" value={`${(metrics.epsilon * 100).toFixed(1)}%`} colorClass="text-indigo-400" />
              <MetricCard label="Episodes" value={metrics.episodes} colorClass="text-purple-400" />
              <MetricCard label="Model Loss" value={metrics.avgLoss.toFixed(4)} colorClass="text-rose-400" />
            </div>

            <div className="bg-gradient-to-br from-indigo-500/5 to-purple-600/5 p-5 rounded-2xl border border-indigo-500/20 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-indigo-400 text-sm">⚡</span>
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Active Policy</span>
                <span className="ml-auto text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md">
                  {aiDecision.confidence}% Confidence
                </span>
              </div>
              <div className="text-2xl font-black text-white mb-5 uppercase tracking-tighter">
                {aiDecision.action.replace('_', ' ')}
              </div>

              <div className="space-y-3">
                {ACTIONS.map((action, i) => (
                  <div key={action} className="flex items-center gap-3">
                    <div className="text-[10px] font-mono text-zinc-500 w-24 truncate">{action.replace('_', ' ')}</div>
                    <div className="flex-1 h-6 bg-zinc-950 border border-zinc-900 rounded-md overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, (aiDecision.qValues[i] + 50) * 2))}%` }}
                      />
                      <span className="absolute right-2 top-1 text-[10px] font-mono font-bold text-white/60">
                        {aiDecision.qValues[i]?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reward Graph */}
            <div className="flex-1 min-h-[120px] bg-zinc-950/50 rounded-2xl border border-zinc-900 p-4">
              <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex justify-between">
                <span>Learning Convergence</span>
                <span className="text-zinc-700">Recent 50 Ep</span>
              </div>
              <div className="h-[100px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rewardData}>
                    <Line type="monotone" dataKey="reward" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <XAxis hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: '10px' }}
                      itemStyle={{ color: '#818cf8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Global Status Footer */}
      <footer className="px-4 sm:px-6 py-3 bg-zinc-950 border-t border-zinc-900 flex flex-wrap justify-between items-center gap-2 text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] shrink-0">
        <div className="flex flex-wrap gap-4 sm:gap-8">
          <span className="flex items-center gap-2">
            <span className="text-emerald-500">🌿</span> CO₂ Reduction Target: -30%
          </span>
          <span className="flex items-center gap-2">
            <span className="text-indigo-400">🧠</span> Core: Double DQN (HeNormal)
          </span>
          <span className="flex items-center gap-2">
            <span className="text-purple-400">🎯</span> Discount γ: {GAMMA}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="italic">Neural City Management OS</span>
          <span className="text-emerald-500 text-xs">●</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
