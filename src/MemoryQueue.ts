import { QueueAdapter, Task } from "./types";

export class MemoryQueue implements QueueAdapter {
  private queue: Task[] = [];
  private processing: Map<string, Task> = new Map();

  async enqueue(task: Task): Promise<void> {
    this.queue.push(task);
  }

  async dequeue(): Promise<Task | null> {
    const task = this.queue.shift();
    if (!task) return null;

    this.processing.set(task.id, task);
    return task;
  }

  async acknowledge(taskId: string): Promise<void> {
    this.processing.delete(taskId);
  }

  async reject(taskId: string, error?: Error): Promise<void> {
    const task = this.processing.get(taskId);
    if (task) {
      this.processing.delete(taskId);
      // Re-queue the task for retry
      this.queue.push(task);
    }
  }
}
