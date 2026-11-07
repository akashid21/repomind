import { parseEnvironment } from "../config/env.js";
import { createDatabasePool } from "../db/pool.js";
import { createLogger } from "../logging/logger.js";

async function main(): Promise<void> {
  const config = parseEnvironment();
  const log = createLogger(config.LOG_LEVEL);
  const pool = createDatabasePool(config.DATABASE_URL);

  try {
    await pool.query("SELECT 1");
    log.info("Database connection established");
  } catch (error) {
    log.error({ error }, "Database connection failed");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  createLogger().error({ error }, "Database check could not start");
  process.exitCode = 1;
});
