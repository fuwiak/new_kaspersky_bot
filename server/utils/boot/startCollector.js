const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

/**
 * Starts the collector process as a child process of the server.
 * This is needed for Railway and other platforms where we can't use docker-entrypoint.sh
 * to start both processes.
 */
async function startCollector() {
  const runtime = process.env.ANYTHING_LLM_RUNTIME || process.env.RUNTIME;
  const nodeEnv = process.env.NODE_ENV;
  const collectorPort = process.env.COLLECTOR_PORT || 8888;

  // Only start collector in production/docker mode
  // In development, collector is started separately
  if (nodeEnv === "development") {
    console.log(
      "[CollectorManager] Skipping collector auto-start in development mode"
    );
    return true;
  }

  // Check if collector is already running
  const isAlreadyRunning = await checkCollectorHealth(collectorPort);
  if (isAlreadyRunning) {
    console.log(
      `[CollectorManager] Collector already running on port ${collectorPort}`
    );
    return true;
  }

  console.log("[CollectorManager] Starting collector process...");
  console.log(`[CollectorManager]   Runtime: ${runtime || "unknown"}`);
  console.log(`[CollectorManager]   NODE_ENV: ${nodeEnv}`);
  console.log(`[CollectorManager]   Port: ${collectorPort}`);

  // Determine collector path
  const collectorPath = path.resolve(__dirname, "../../../collector");
  const collectorIndexPath = path.join(collectorPath, "index.js");

  // Check if collector exists
  const fs = require("fs");
  if (!fs.existsSync(collectorIndexPath)) {
    // Try alternative path for Docker
    const dockerCollectorPath = "/app/collector/index.js";
    if (fs.existsSync(dockerCollectorPath)) {
      console.log(
        `[CollectorManager] Using Docker collector path: ${dockerCollectorPath}`
      );
      return startCollectorProcess("/app/collector", collectorPort);
    }

    console.error(
      `[CollectorManager] Collector not found at ${collectorIndexPath}`
    );
    console.error(
      "[CollectorManager] File upload will not work without collector"
    );
    return false;
  }

  return startCollectorProcess(collectorPath, collectorPort);
}

/**
 * Starts the collector process
 * @param {string} collectorPath - Path to collector directory
 * @param {number} port - Port for collector to listen on
 */
function startCollectorProcess(collectorPath, port) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      COLLECTOR_PORT: port.toString(),
      NODE_ENV: process.env.NODE_ENV || "production",
    };

    console.log(`[CollectorManager] Spawning collector from: ${collectorPath}`);

    const collector = spawn("node", ["index.js"], {
      cwd: collectorPath,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    // Handle collector stdout
    collector.stdout.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line) => {
        if (line.trim()) {
          console.log(`[collector] ${line}`);
        }
      });
    });

    // Handle collector stderr
    collector.stderr.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line) => {
        if (line.trim()) {
          console.error(`[collector] ${line}`);
        }
      });
    });

    // Handle collector exit
    collector.on("exit", (code, signal) => {
      console.warn(
        `[CollectorManager] Collector process exited with code ${code} and signal ${signal}`
      );
    });

    collector.on("error", (error) => {
      console.error(`[CollectorManager] Failed to start collector:`, error);
      resolve(false);
    });

    // Wait for collector to be ready
    waitForCollector(port, 30000)
      .then((ready) => {
        if (ready) {
          console.log(
            `[CollectorManager] ✓ Collector is ready on port ${port}`
          );
        } else {
          console.error(
            `[CollectorManager] ✗ Collector failed to start within timeout`
          );
        }
        resolve(ready);
      })
      .catch((err) => {
        console.error(`[CollectorManager] Error waiting for collector:`, err);
        resolve(false);
      });
  });
}

/**
 * Checks if collector is healthy
 * @param {number} port - Collector port
 * @returns {Promise<boolean>}
 */
function checkCollectorHealth(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: port,
        path: "/",
        method: "GET",
        timeout: 2000,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Waits for collector to be ready
 * @param {number} port - Collector port
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForCollector(port, timeout = 30000) {
  const startTime = Date.now();
  const checkInterval = 500;

  while (Date.now() - startTime < timeout) {
    const isReady = await checkCollectorHealth(port);
    if (isReady) {
      return true;
    }
    await new Promise((r) => setTimeout(r, checkInterval));
  }

  return false;
}

module.exports = {
  startCollector,
  checkCollectorHealth,
  waitForCollector,
};
