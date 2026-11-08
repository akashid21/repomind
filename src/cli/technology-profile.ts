import { pathToFileURL } from "node:url";
import { InventoryCliError, resolveInventoryRoot } from "./inventory.js";
import { createInventoryReport } from "../inventory/report.js";
import { InventoryTraversalError } from "../inventory/traversal.js";
import {
  readTechnologyManifests,
  ManifestReaderError,
} from "../technology/manifest-reader.js";
import {
  assembleTechnologyProfile,
  serializeTechnologyProfile,
} from "../technology/profile.js";

const USAGE = "Usage: npm run --silent technology-profile -- <repository-path>";

export class TechnologyProfileCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechnologyProfileCliError";
  }
}

export function parseTechnologyProfileArgs(args: readonly string[]): string {
  if (args.length !== 1 || args[0] === undefined || args[0].trim() === "") {
    throw new TechnologyProfileCliError(
      `${USAGE}\nProvide exactly one repository path.`,
    );
  }
  return args[0];
}

async function main(): Promise<void> {
  try {
    const repositoryPath = parseTechnologyProfileArgs(process.argv.slice(2));
    const canonicalRoot = await resolveInventoryRoot(repositoryPath);
    const inventory = await createInventoryReport(canonicalRoot);
    const manifestResult = await readTechnologyManifests(
      canonicalRoot,
      inventory.files,
    );
    const profile = assembleTechnologyProfile(inventory.files, manifestResult);
    process.stdout.write(serializeTechnologyProfile(profile));
  } catch (error) {
    const message =
      error instanceof TechnologyProfileCliError ||
      error instanceof InventoryCliError ||
      error instanceof InventoryTraversalError ||
      error instanceof ManifestReaderError
        ? error.message
        : "Technology profile command failed unexpectedly.";
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
