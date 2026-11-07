import { parseEnvironment } from "./config/env.js";
import { createLogger } from "./logging/logger.js";

const config = parseEnvironment();
const logger = createLogger(config.LOG_LEVEL);

logger.info({ mode: config.NODE_ENV }, "RepoMind foundation started");
