/**
 * Replays real leaked messages out of the local pi session history.
 *
 * This is the test that actually proves the grammar matches production output
 * rather than a fixture someone typed by hand. It is skipped wherever that
 * history is unavailable (CI, a fresh machine), so the suite stays portable.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recoverDsmlToolCalls, type AssistantMessageLike } from "../src/recover.ts";

const SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");

const samples = collectSamples();

describe.skipIf(samples.length === 0)("real session replay", () => {
  it("found leaked DSML messages to replay", () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  it.each(samples)("recovers tool calls from $file", ({ message }) => {
    const result = recoverDsmlToolCalls(message);

    expect(result.changed).toBe(true);
    expect(result.recovered.length).toBeGreaterThan(0);
    for (const call of result.recovered) {
      expect(call.name).toMatch(/^[\w.-]+$/);
    }

    const text = JSON.stringify(result.message.content.filter(isText));
    expect(text).not.toContain("DSML");
  });
});

interface Sample {
  file: string;
  message: AssistantMessageLike;
}

function collectSamples(): Sample[] {
  if (!existsSync(SESSIONS_DIR)) return [];

  const samples: Sample[] = [];
  for (const file of walk(SESSIONS_DIR)) {
    if (!file.endsWith(".jsonl")) continue;

    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.includes("DSML")) continue;

      const message = parseAssistantMessage(line);
      if (message && message.content.some((part) => isText(part) && part.text.includes("DSML"))) {
        samples.push({ file: file.slice(SESSIONS_DIR.length + 1), message });
      }
    }
  }
  return samples;
}

function parseAssistantMessage(line: string): AssistantMessageLike | undefined {
  try {
    const entry = JSON.parse(line) as { message?: AssistantMessageLike };
    const message = entry.message;
    return message?.role === "assistant" && Array.isArray(message.content) ? message : undefined;
  } catch {
    return undefined;
  }
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

function isText(part: unknown): part is { type: "text"; text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "text" &&
    typeof (part as { text?: unknown }).text === "string"
  );
}
