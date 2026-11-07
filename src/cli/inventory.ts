import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const USAGE = "Usage: npm run inventory -- <repository-path>";

export class InventoryCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryCliError";
  }
}

export function parseInventoryArgs(args: readonly string[]): string {
  if (args.length !== 1 || args[0] === undefined || args[0].trim() === "") {
    throw new InventoryCliError(
      `${USAGE}\nProvide exactly one repository path.`,
    );
  }

  return args[0];
}

export async function resolveInventoryRoot(
  repositoryPath: string,
): Promise<string> {
  const requestedPath = path.resolve(repositoryPath);

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(requestedPath);
  } catch {
    throw new InventoryCliError(
      "Repository path does not exist or is inaccessible.",
    );
  }

  let rootStats;
  try {
    rootStats = await stat(canonicalPath);
  } catch {
    throw new InventoryCliError("Repository path cannot be inspected.");
  }

  if (!rootStats.isDirectory()) {
    throw new InventoryCliError("Repository path must be a directory.");
  }

  return canonicalPath;
}

async function main(): Promise<void> {
  try {
    const repositoryPath = parseInventoryArgs(process.argv.slice(2));
    await resolveInventoryRoot(repositoryPath);
    process.stderr.write("Inventory report output is not wired yet.\n");
    process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof InventoryCliError
        ? error.message
        : "Inventory command failed unexpectedly.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
