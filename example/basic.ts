import { HiveCycle, Task } from "../src";

interface MyTasks {
  email: { to: string };
  report: { reportId: string };
}

const app = new HiveCycle<MyTasks>({
  maxConcurrency: 2,
  pollingInterval: 500,
  healthPort: 8080,
});

// Register a handler for 'email' tasks
app.registerHandler("email", async (task) => {
  console.log(`Sending email to ${task.payload.to}...`);
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(`Email sent to ${task.payload.to}!`);
});

// Register a handler for 'report' tasks
app.registerHandler("report", async (task) => {
  console.log(`Generating report ${task.payload.reportId}...`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log(`Report ${task.payload.reportId} generated.`);
});

async function main() {
  // Start the engine
  app.start();

  // Queue some tasks
  console.log("Queueing tasks...");
  await app.enqueue("email", { to: "user1@example.com" });
  await app.enqueue("email", { to: "user2@example.com" });
  await app.enqueue("report", { reportId: "R-1001" });
  await app.enqueue("email", { to: "user3@example.com" });

  // Let it run for a bit then stop
  setTimeout(() => {
    app.stop();
    console.log("Done.");
  }, 10000);
}

main().catch(console.error);
