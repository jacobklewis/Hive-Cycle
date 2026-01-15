import { HiveCycle } from "../src";

const app = new HiveCycle({
  maxConcurrency: 1,
  pollingInterval: 100,
});

app.registerHandler("tick", async (task) => {
  console.log(`[${new Date().toISOString()}] Tick! Payload:`, task.payload);
});

async function main() {
  app.start();

  console.log("Queueing a recurring task...");
  await app.enqueue(
    "tick",
    { count: 1 },
    {
      requeue: true,
      requeueDelay: 1000, // Requeue after 1 second
    }
  );

  // Let it run for 5 cycles approx
  setTimeout(() => {
    app.stop();
    console.log("Stopping...");
  }, 5500);
}

main().catch(console.error);
