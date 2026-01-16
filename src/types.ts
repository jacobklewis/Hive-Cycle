export interface Task<T = any> {
  id: string;
  type: string;
  payload: T;
  retries?: number;
  timestamp?: number;
  requeue?: boolean;
  requeueDelay?: number;
}

export interface QueueAdapter {
  /**
   * Add a task to the queue
   */
  enqueue(task: Task): Promise<void>;

  /**
   * Retrieve the next task from the queue.
   * Should return null if the queue is empty.
   */
  dequeue(): Promise<Task | null>;

  /**
   * Mark a task as successfully completed.
   */
  acknowledge(taskId: string): Promise<void>;

  /**
   * Handle a task failure (e.g., re-queue or move to DLQ).
   */
  reject(taskId: string, error?: Error): Promise<void>;
}

export interface TaskHandler<T = any> {
  (task: Task<T>): Promise<void>;
}

export interface HiveCycleOptions {
  queue?: QueueAdapter;
  pollingInterval?: number;
  maxConcurrency?: number;
  logger?: Logger;
  /**
   * If provided, starts a health check HTTP server on this port.
   */
  healthPort?: number;
}

export interface Logger {
  log(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
}
