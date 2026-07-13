
import { 
  ACTIONS, 
  STATE_SIZE, 
  LEARNING_RATE, 
  GAMMA, 
  MEMORY_SIZE, 
  BATCH_SIZE, 
  INITIAL_EPSILON, 
  EPSILON_DECAY, 
  EPSILON_MIN, 
  TARGET_UPDATE_FREQ 
} from '../constants';

// Declare global tf as we loaded it via script tag for performance and reliability
declare const tf: any;

export class DQNAgent {
  memory: any[] = [];
  epsilon: number = INITIAL_EPSILON;
  model: any = null;
  targetModel: any = null;
  isDisposed: boolean = false;
  trainStep: number = 0;
  episodeRewards: number[] = [];
  losses: number[] = [];

  constructor() {
    this.initialize();
  }

  initialize() {
    try {
      if (this.model) this.model.dispose();
      if (this.targetModel) this.targetModel.dispose();
      this.model = this.createModel();
      this.targetModel = this.createModel();
      this.updateTarget();
      this.isDisposed = false;
    } catch (error) {
      console.error('Error initializing DQN:', error);
    }
  }

  createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ 
      units: 128, 
      inputShape: [STATE_SIZE], 
      activation: 'relu', 
      kernelInitializer: 'heNormal' 
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dense({ units: ACTIONS.length, activation: 'linear' }));
    model.compile({ 
      loss: 'meanSquaredError', 
      optimizer: tf.train.adam(LEARNING_RATE) 
    });
    return model;
  }

  updateTarget() {
    if (this.isDisposed) return;
    try {
      const weights = this.model.getWeights();
      const targetWeights = weights.map((w: any) => w.clone());
      this.targetModel.setWeights(targetWeights);
      targetWeights.forEach((w: any) => w.dispose());
    } catch (error) {
      console.error('Error updating target:', error);
    }
  }

  remember(state: number[], action: number, reward: number, nextState: number[], done: boolean) {
    if (this.memory.length >= MEMORY_SIZE) this.memory.shift();
    this.memory.push({ state, action, reward, nextState, done });
  }

  act(state: number[]) {
    if (this.isDisposed) return 0;
    if (Math.random() <= this.epsilon) {
      return Math.floor(Math.random() * ACTIONS.length);
    }
    try {
      return tf.tidy(() => {
        const stateTensor = tf.tensor2d([state]);
        const prediction = this.model.predict(stateTensor);
        return prediction.argMax(1).dataSync()[0];
      });
    } catch (error) {
      console.error('Error in act:', error);
      return 0;
    }
  }

  getQValues(state: number[]) {
    if (this.isDisposed) return [0, 0, 0];
    try {
      return tf.tidy(() => {
        const stateTensor = tf.tensor2d([state]);
        const prediction = this.model.predict(stateTensor);
        return Array.from(prediction.dataSync()) as number[];
      });
    } catch (error) {
      return [0, 0, 0];
    }
  }

  async replay() {
    if (this.isDisposed || this.memory.length < BATCH_SIZE) return null;
    try {
      const indices = new Set<number>();
      while (indices.size < BATCH_SIZE) {
        indices.add(Math.floor(Math.random() * this.memory.length));
      }
      const batch = Array.from(indices).map(i => this.memory[i]);

      const loss = await tf.tidy(async () => {
        const states = tf.tensor2d(batch.map(x => x.state));
        const nextStates = tf.tensor2d(batch.map(x => x.nextState));
        
        const currentQs = await this.model.predict(states).array();
        const nextQsTarget = await this.targetModel.predict(nextStates).array();

        batch.forEach((sample, i) => {
          let target = sample.reward;
          if (!sample.done) {
            target += GAMMA * Math.max(...nextQsTarget[i]);
          }
          currentQs[i][sample.action] = target;
        });

        const targetQs = tf.tensor2d(currentQs);
        const history = await this.model.fit(states, targetQs, { epochs: 1, verbose: 0 });
        return history.history.loss[0];
      });

      this.losses.push(loss);
      if (this.losses.length > 100) this.losses.shift();
      if (this.epsilon > EPSILON_MIN) this.epsilon *= EPSILON_DECAY;
      this.trainStep++;
      if (this.trainStep % TARGET_UPDATE_FREQ === 0) this.updateTarget();

      return loss;
    } catch (error) {
      console.error('Error in replay:', error);
      return null;
    }
  }

  getAverageLoss() {
    if (this.losses.length === 0) return 0;
    return this.losses.reduce((a, b) => a + b, 0) / this.losses.length;
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (this.model) { this.model.dispose(); this.model = null; }
    if (this.targetModel) { this.targetModel.dispose(); this.targetModel = null; }
  }
}
