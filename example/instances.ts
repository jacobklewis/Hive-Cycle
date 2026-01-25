import { HiveCycle } from "../src";

const app = new HiveCycle({ maxConcurrency: 2 });

// A simple worker that simulates processing time based on the instance index
app.registerHandler("data-processing", async (task) => {
  const { batchId } = task.payload;
  const instanceIndex = task.instanceIndex || 0;

  console.log(
    `[Worker] Starting processing for Batch: ${batchId}, Instance: ${instanceIndex}`,
  );

  // Simulate some work...
  const processingTime = 500 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, processingTime));
  console.log(
    `[Worker] Completed processing for Batch: ${batchId}, Instance: ${instanceIndex} in ${processingTime.toFixed(
      0,
    )}ms`,
  );
});

app.start();

// Queue 3 instances of the same task
console.log("enqueuing 3 instances of 'data-processing'...");
app
  .enqueue(
    "data-processing",
    { batchId: "abc-123" },
    { instances: 3, requeue: true, requeueDelay: 2000 },
  )
  .then(() => console.log("Tasks enqueued. Watch the logs above."))
  .catch((err) => console.error("Error enqueuing:", err));
