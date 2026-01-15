![HiveCycle Logo](logo.png)

# HiveCycle

A modular, type-safe TypeScript framework for running background task queues. `HiveCycle` provides a robust backbone for processing queued jobs with concurrency control, automatic retries/requeues, and pluggable queue storage.

## Features

- **Continuous Execution**: Runs a worker loop that constantly polls for new tasks.
- **Type Safe**: leveraging TypeScript generics to strongly type your task payloads.
- **Modular**: Abstract `QueueAdapter` allowing you to swap the default In-Memory queue for Redis, RabbitMQ, or SQL/NoSQL databases.
- **Concurrency Control**: Limit how many tasks are processed simultaneously.
- **Recurring Tasks**: Built-in support for tasks that automatically requeue themselves (cron-like behavior).

## Installation

```bash
npm install hive-cycle
```

## Quick Start

### Basic Usage

```typescript
import { HiveCycle } from "hive-cycle";

const app = new HiveCycle();

// 1. Register a handler
app.registerHandler("email", async (task) => {
  console.log("Sending email to:", task.payload.to);
  // Perform async work here...
});

// 2. Start the engine
app.start();

// 3. Queue a task
app.enqueue("email", { to: "user@example.com" });
```

### Type Safety

Define your task map interface to get full autocomplete and type checking for payloads.

```typescript
import { HiveCycle } from "hive-cycle";

// Define your task types and their payloads
interface MyTaskMap {
  "send-email": { to: string; subject: string; body: string };
  "generate-report": { reportId: string };
}

const app = new HiveCycle<MyTaskMap>();

// ✅ Fully typed argument
app.registerHandler("send-email", async (task) => {
  // task.payload is { to: string; subject: string; body: string }
  console.log(task.payload.subject);
});

// ✅ Type-checked enqueue
app.enqueue("send-email", {
  to: "test@example.com",
  subject: "Welcome",
  body: "Hello World",
});
```

## Advanced Usage

### Recurring Tasks

You can schedule tasks to automatically requeue themselves after completion, creating a loop.

```typescript
await app.enqueue(
  "cleanup-job",
  { key: "temp-files" },
  {
    requeue: true,
    requeueDelay: 5000, // Run again 5 seconds after completion
  }
);
```

### Configuration

You can pass options to the constructor to tune performance.

```typescript
const app = new HiveCycle({
  // How many tasks to process in parallel
  maxConcurrency: 5,

  // How often to check for new tasks when queue is empty (ms)
  pollingInterval: 1000,

  // Custom logger (defaults to console)
  logger: myLogger,

  // Custom Queue Adapter (defaults to MemoryQueue)
  queue: new RedisQueueAdapter(),
});
```

### Custom Queue Adapter

To use a persistent store (like Redis), implement the `QueueAdapter` interface.

```typescript
import { QueueAdapter, Task } from "hive-cycle";

class MyRedisQueue implements QueueAdapter {
  async enqueue(task: Task): Promise<void> {
    /* ... */
  }
  async dequeue(): Promise<Task | null> {
    /* ... */
  }
  async acknowledge(taskId: string): Promise<void> {
    /* ... */
  }
  async reject(taskId: string, error?: Error): Promise<void> {
    /* ... */
  }
}
```

## License

MIT
