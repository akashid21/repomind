import pino from "pino";

export function createLogger(level: string = "info") {
  return pino({
    level,
    redact: {
      paths: [
        "DATABASE_URL",
        "*.DATABASE_URL",
        "password",
        "*.password",
        "token",
        "*.token",
      ],
      censor: "[REDACTED]",
    },
  });
}

export const logger = createLogger(process.env.LOG_LEVEL);
