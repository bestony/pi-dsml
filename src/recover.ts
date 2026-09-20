/**
 * Turn DSML text in a finalized assistant message into real tool calls.
 *
 * Pi's agent loop reads `message.content` for `toolCall` blocks *after* the
 * `message_end` hook has had a chance to replace the message, so calls appended
 * here are executed for real.
 */

import { parseDsml, stripRanges, type DsmlToolCall } from "./parse.ts";

export interface AssistantMessageLike {
  role: string;
  content: unknown[];
  stopReason?: string;
  [key: string]: unknown;
}

export interface RecoverResult {
  changed: boolean;
  message: AssistantMessageLike;
  /** Calls appended to the message; empty when only stripping happened. */
  recovered: DsmlToolCall[];
  /** Number of text/thinking blocks that had DSML removed. */
  stripped: number;
}

export interface RecoverOptions {
  /** Injected in tests to keep generated tool-call ids deterministic. */
  makeId?: (call: DsmlToolCall, index: number) => string;
}

export function recoverDsmlToolCalls(
  message: AssistantMessageLike,
  options: RecoverOptions = {},
): RecoverResult {
  const unchanged: RecoverResult = { changed: false, message, recovered: [], stripped: 0 };
  if (message.role !== "assistant" || !Array.isArray(message.content)) return unchanged;

  const pending: DsmlToolCall[] = [];
  let stripped = 0;

  const content = message.content.map((part) => {
    const text = readText(part);
    if (text === undefined) return part;

    const { calls, ranges } = parseDsml(text);
    if (ranges.length === 0) return part;

    pending.push(...calls);
    stripped++;
    return writeText(part, stripRanges(text, ranges));
  });

  if (stripped === 0) return unchanged;

  // A message that already carries native tool calls only needs the leaked text
  // cleaned up — appending the parsed copies would execute everything twice.
  const hasNativeToolCalls = message.content.some(isToolCall);
  const recovered = hasNativeToolCalls ? [] : pending;
  const makeId = options.makeId ?? defaultMakeId;

  for (const [index, call] of recovered.entries()) {
    content.push({
      type: "toolCall",
      id: makeId(call, index),
      name: call.name,
      arguments: call.arguments,
    });
  }

  const next: AssistantMessageLike = { ...message, content };
  if (recovered.length > 0) next.stopReason = "toolUse";

  return { changed: true, message: next, recovered, stripped };
}

function defaultMakeId(_call: DsmlToolCall, index: number): string {
  return `dsml_${Date.now().toString(36)}_${index}`;
}

function readText(part: unknown): string | undefined {
  if (!isRecord(part)) return undefined;
  if (part.type === "text" && typeof part.text === "string") return part.text;
  if (part.type === "thinking" && typeof part.thinking === "string") return part.thinking;
  return undefined;
}

function writeText(part: unknown, text: string): unknown {
  if (!isRecord(part)) return part;
  if (part.type === "text") return { ...part, text };
  if (part.type === "thinking") return { ...part, thinking: text };
  return part;
}

function isToolCall(part: unknown): boolean {
  return isRecord(part) && part.type === "toolCall";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
