import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import {
  HiveCycleOptions,
  QueueAdapter,
  Task,
  TaskHandler,
  Logger,
} from "./types";
import { MemoryQueue } from "./MemoryQueue";

// I will implement a simple ID generator to avoid deps for now if I didn't install uuid.
// Wait, I haven't installed `uuid`. I should probably implement a simple random ID or install it later.
// User didn't ask for uuid specifically, so I'll use crypto.randomUUID if available or Math.random shim.

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

export class HiveCycle<
  TaskMap extends Record<string, any> = Record<string, any>,
> {
  private queue: QueueAdapter;
  private handlers: Map<string, TaskHandler> = new Map();
  private isRunning: boolean = false;
  private options: Required<Omit<HiveCycleOptions, "healthPort">> & {
    healthPort?: number;
  };
  private activeCount: number = 0;
  private server?: Server;

  constructor(options: HiveCycleOptions = {}) {
    this.options = {
      queue: options.queue || new MemoryQueue(),
      pollingInterval: options.pollingInterval || 1000,
      maxConcurrency: options.maxConcurrency || 1,
      logger: options.logger || console,
      healthPort: options.healthPort,
    };
    this.queue = this.options.queue;
  }

  /**
   * Register a handler for a specific task type.
   */
  public registerHandler<K extends keyof TaskMap & string>(
    type: K,
    handler: TaskHandler<TaskMap[K]>,
  ): void {
    this.handlers.set(type, handler as TaskHandler);
  }

  /**
   * Enqueue a new task.
   */
  public async enqueue<K extends keyof TaskMap & string>(
    type: K,
    payload: TaskMap[K],
    options?: Partial<Task>,
  ): Promise<string> {
    const task: Task<TaskMap[K]> = {
      id: generateId(),
      type,
      payload,
      timestamp: Date.now(),
      ...options,
    };
    const instances =
      options?.instances && options.instances > 0 ? options.instances : 1;
    for (let i = 0; i < instances; i++) {
      // Enqueue multiple instances if specified
      const instanceTask = {
        ...task,
        instanceIndex:
          instances === 1 && options?.instanceIndex !== undefined
            ? options.instanceIndex
            : i,
      };
      await this.queue.enqueue(instanceTask);
    }
    return task.id;
  }

  /**
   * Start the worker loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.options.logger.log("HiveCycle engine started.");

    if (this.options.healthPort) {
      this.startHealthServer(this.options.healthPort);
    }

    this.loop();
  }

  /**
   * Stop the worker loop.
   */
  public stop(): void {
    this.isRunning = false;
    this.options.logger.log("HiveCycle engine stopping...");
    this.stopHealthServer();
  }

  private startHealthServer(port: number): void {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            running: this.isRunning,
            activeCount: this.activeCount,
          }),
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(port, () => {
      this.options.logger.log(`Health check server listening on port ${port}`);
    });

    this.server.on("error", (err) => {
      this.options.logger.error("Health server error:", err);
    });
  }

  private stopHealthServer(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }

  private async loop(): Promise<void> {
    while (this.isRunning) {
      if (this.activeCount < this.options.maxConcurrency) {
        try {
          const task = await this.queue.dequeue();
          if (task) {
            this.handleTask(task);
            // If we have concurrency, we might want to immediately try to fetch another one
            // instead of waiting specifically. But to prevent tight CPU looping in async:
            // we continue the loop.
            continue;
          } else {
            // Queue empty
            await this.sleep(this.options.pollingInterval);
          }
        } catch (err) {
          this.options.logger.error("Error in main loop:", err);
          await this.sleep(this.options.pollingInterval);
        }
      } else {
        // Max concurrency reached
        await this.sleep(100);
      }
    }
  }

  private async handleTask(task: Task): Promise<void> {
    this.activeCount++;
    try {
      const handler = this.handlers.get(task.type);
      if (!handler) {
        throw new Error(`No handler registered for task type: ${task.type}`);
      }

      await handler(task);
      await this.queue.acknowledge(task.id);

      if (task.requeue) {
        const nextRun = async () => {
          try {
            await this.enqueue(task.type as any, task.payload, {
              requeue: true,
              requeueDelay: task.requeueDelay,
              instanceIndex: task.instanceIndex,
            });
          } catch (e) {
            this.options.logger.error(
              `Failed to automatically requeue task ${task.type}`,
              e,
            );
          }
        };

        if (task.requeueDelay && task.requeueDelay > 0) {
          setTimeout(nextRun, task.requeueDelay);
        } else {
          await nextRun();
        }
      }
    } catch (err: any) {
      this.options.logger.error(`Task ${task.id} failed:`, err);

      if (task.retries && task.retries > 0) {
        const attemptsLeft = task.retries - 1;
        this.options.logger.log(
          `Retrying task ${task.id}. Attempts left: ${attemptsLeft}`,
        );
        const retryingTask = { ...task, retries: attemptsLeft };
        try {
          await this.queue.enqueue(retryingTask);
          await this.queue.acknowledge(task.id);
          return;
        } catch (requeueErr) {
          this.options.logger.error(
            `Failed to requeue task ${task.id}`,
            requeueErr,
          );
        }
      }

      // Depending on the queue implementation, reject might be handled differently
      await this.queue.reject(task.id, err);
    } finally {
      this.activeCount--;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
