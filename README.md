# Neural Traffic Control AI Simulation

This project is a React-based Deep Q-Network (DQN) simulation environment designed to optimize traffic light control at an intersection. Built with TypeScript and a custom neural logic agent, it demonstrates how Multi-Agent Reinforcement Learning (MARL) can dramatically improve urban mobility by minimizing wait times, reducing vehicle idling, and cutting down CO₂ emissions.

## 🧠 Core Architecture

The simulation comprises two main systems:

1. **The Environment (React + HTML5 Canvas)**
   - Simulates a 4-way intersection with dynamic vehicle spawns (cars and trucks).
   - Tracks metrics like vehicle queues, wait times, speeds, and real-time emissions based on vehicle acceleration/idling.
   - Includes environmental factors like weather (Sunny, Rainy, Foggy) that affect vehicle braking distance and AI decision-making.

2. **The DQN Agent (`services/dqnAgent`)**
   - **State Space**: Observes real-time data including N/S and E/W queue lengths, stopped vehicles, current traffic light phase, timer, average speeds, maximum wait times, and weather factors.
   - **Action Space**: Decides whether to KEEP the current traffic phase or SWITCH to the other direction to optimize flow.
   - **Reward Function**: Rewards the agent when vehicles successfully pass the intersection, but heavily penalizes long queues and high CO₂ emissions, forcing the AI to find the most eco-friendly and efficient traffic rhythm.

## 🚀 Key Features

- **Real-Time Neural Learning**: Watch the AI learn as it explores (high epsilon) and eventually exploits (low epsilon) the best strategies.
- **Eco-Metrics**: Live tracking of CO₂ emissions saved versus a standard timed traffic light.
- **Live Visualizations**: Integrated `recharts` dashboards for tracking Episode Rewards, Loss, and Epsilon decay over time.
- **Dynamic Weather Integration**: Weather modes alter vehicle dynamics, forcing the AI to adapt its timing for safety and efficiency.

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + TensorFlow
- **Build Tool**: Vite
- **Data Visualization**: Recharts
- **Styling**: Tailwind CSS (integrated into the Green-Pulse UI)
- **AI Core**: Custom DQN implementation

## 🚦 Getting Started

To run the simulation locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the provided `localhost` port in your browser to view the active AI training environment.

## 🌍 Part of the Green-Pulse Ecosystem

This simulation serves as the "Digital Twin Sandbox" engine for the **Green-Pulse Autonomous Urban Traffic Command Center**. The insights and pre-trained models from this sandbox dictate the real-world control logic deployed across the grid to achieve Net-Zero urban transport.
