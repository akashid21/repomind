import { z } from "zod";

const EnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    }, "DATABASE_URL must use the postgres or postgresql protocol"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function parseEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return EnvironmentSchema.parse(source);
}
