/**
 * Optional config, read from `<agent dir>/extensions/pi-dsml.json`.
 *
 * Every field has a safe default, so a missing or broken file is never fatal:
 * the extension simply runs with recovery on for every model.
 */

import { existsSync, readFileSync } from "node:fs";

export interface DsmlConfig {
  enabled: boolean;
  /** Case-insensitive regex fragments; when set, only matching model ids are touched. */
  models?: string[];
  /** Hide DSML spans while the response streams. */
  hideWhileStreaming: boolean;
  debug: boolean;
}

export const DEFAULT_CONFIG: DsmlConfig = {
  enabled: true,
  hideWhileStreaming: true,
  debug: Boolean(process.env.PI_DSML_DEBUG),
};

export function loadConfig(path: string): DsmlConfig {
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };

  try {
    return normalizeConfig(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[pi-dsml] ignoring unreadable config at ${path}: ${reason}\n`);
    return { ...DEFAULT_CONFIG };
  }
}

export function normalizeConfig(raw: unknown): DsmlConfig {
  if (!isRecord(raw)) return { ...DEFAULT_CONFIG };

  const models = Array.isArray(raw.models)
    ? raw.models.filter((pattern): pattern is string => typeof pattern === "string" && isValidRegex(pattern))
    : undefined;

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.enabled,
    hideWhileStreaming:
      typeof raw.hideWhileStreaming === "boolean"
        ? raw.hideWhileStreaming
        : DEFAULT_CONFIG.hideWhileStreaming,
    debug: typeof raw.debug === "boolean" ? raw.debug || DEFAULT_CONFIG.debug : DEFAULT_CONFIG.debug,
    ...(models && models.length > 0 ? { models } : {}),
  };
}

/** No `models` list means "every model"; an unknown model id is never excluded. */
export function appliesToModel(config: DsmlConfig, modelId: string | undefined): boolean {
  if (!config.enabled) return false;
  if (!config.models || config.models.length === 0) return true;
  if (!modelId) return true;
  return config.models.some((pattern) => new RegExp(pattern, "i").test(modelId));
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, "i");
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
