import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreaker,
  ConsecutiveBreaker,
  SamplingBreaker,
  ExponentialBackoff,
  wrap,
  circuitBreak,
  handleAll,
} from 'cockatiel';
import { ServiceUnavailableException } from '../exceptions/service-unavailable.exception';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  recoveryTimeout: number;
  samplingDuration: number;
  successThreshold?: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  openedAt?: Date;
  halfOpenedAt?: Date;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly metrics = new Map<string, CircuitBreakerMetrics>();

  /**
   * Create or get a circuit breaker with the given configuration
   */
  getBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    if (this.breakers.has(config.name)) {
      return this.breakers.get(config.name)!;
    }

    const breaker = this.createBreaker(config);
    this.breakers.set(config.name, breaker);
    this.metrics.set(config.name, {
      name: config.name,
      state: 'closed',
      failures: 0,
      successes: 0,
    });

    return breaker;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    config: CircuitBreakerConfig,
    fn: () => Promise<T>,
  ): Promise<T> {
    const breaker = this.getBreaker(config);
    const metrics = this.metrics.get(config.name)!;

    try {
      const result = await breaker.execute(fn);
      this.updateMetrics(metrics, 'success');
      return result;
    } catch (error) {
      this.updateMetrics(metrics, 'failure');

      if (error.name === 'BreakerStateOpen') {
        this.logger.warn(`Circuit breaker '${config.name}' is OPEN - failing fast`);
        throw new ServiceUnavailableException(
          `Service '${config.name}' is temporarily unavailable. Please try again later.`,
          config.name,
        );
      }

      throw error;
    }
  }

  /**
   * Get current metrics for all circuit breakers
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for a specific circuit breaker
   */
  getMetrics(name: string): CircuitBreakerMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Reset a circuit breaker to closed state
   */
  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      this.breakers.delete(name);
      this.metrics.delete(name);
      this.logger.log(`Circuit breaker '${name}' has been reset`);
    }
  }

  private createBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    const breaker = new SamplingBreaker({
      threshold: config.failureThreshold,
      duration: config.samplingDuration,
    });

    breaker.on('open', () => {
      const metrics = this.metrics.get(config.name)!;
      metrics.state = 'open';
      metrics.openedAt = new Date();
      this.logger.warn(
        `Circuit breaker '${config.name}' OPENED after ${config.failureThreshold} failures within ${config.samplingDuration}ms`,
      );
    });

    breaker.on('halfOpen', () => {
      const metrics = this.metrics.get(config.name)!;
      metrics.state = 'half-open';
      metrics.halfOpenedAt = new Date();
      this.logger.log(
        `Circuit breaker '${config.name}' HALF-OPENED - allowing probe request`,
      );
    });

    breaker.on('close', () => {
      const metrics = this.metrics.get(config.name)!;
      metrics.state = 'closed';
      metrics.failures = 0;
      this.logger.log(
        `Circuit breaker '${config.name}' CLOSED - service recovered`,
      );
    });

    return breaker;
  }

  private updateMetrics(
    metrics: CircuitBreakerMetrics,
    outcome: 'success' | 'failure',
  ): void {
    if (outcome === 'success') {
      metrics.successes++;
    } else {
      metrics.failures++;
      metrics.lastFailure = new Date();
    }
  }
}
