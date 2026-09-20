import { describe, expect, it } from "vitest";
import { recoverDsmlToolCalls } from "../src/recover.ts";
import { assistant, FENCED, MANGLED_MULTI, MANGLED_SINGLE, textPart } from "./fixtures.ts";

const ids = { makeId: (_call: unknown, index: number) => `id_${index}` };

describe("recoverDsmlToolCalls", () => {
  it("appends executable tool calls and clears the text", () => {
    const result = recoverDsmlToolCalls(assistant(textPart(MANGLED_SINGLE)), ids);

    expect(result.changed).toBe(true);
    expect(result.message.stopReason).toBe("toolUse");
    expect(result.message.content).toEqual([
      { type: "text", text: "I'll check the project setup first." },
      { type: "toolCall", id: "id_0", name: "bash", arguments: { command: "ls -la" } },
    ]);
  });

  it("recovers every call in a multi-invoke block", () => {
    const result = recoverDsmlToolCalls(assistant(textPart(MANGLED_MULTI)), ids);
    expect(result.recovered.map((call) => call.name)).toEqual(["bash", "glob"]);
  });

  it("recovers unknown tool names as-is, leaving pi to report them", () => {
    const text = MANGLED_SINGLE.replace('name="bash"', 'name="read_file"');
    const result = recoverDsmlToolCalls(assistant(textPart(text)), ids);
    expect(result.recovered[0]?.name).toBe("read_file");
  });

  it("only strips text when the message already has native tool calls", () => {
    const native = { type: "toolCall", id: "native", name: "bash", arguments: { command: "ls" } };
    const result = recoverDsmlToolCalls(assistant(textPart(MANGLED_SINGLE), native), ids);

    expect(result.changed).toBe(true);
    expect(result.recovered).toEqual([]);
    expect(result.message.stopReason).toBe("stop");
    expect(result.message.content).toEqual([
      { type: "text", text: "I'll check the project setup first." },
      native,
    ]);
  });

  it("cleans DSML out of thinking blocks too", () => {
    const message = assistant({ type: "thinking", thinking: MANGLED_SINGLE });
    const result = recoverDsmlToolCalls(message, ids);

    expect(result.message.content[0]).toEqual({
      type: "thinking",
      thinking: "I'll check the project setup first.",
    });
  });

  it("leaves a fenced example alone", () => {
    const message = assistant(textPart(FENCED));
    expect(recoverDsmlToolCalls(message, ids).changed).toBe(false);
  });

  it("returns the original message untouched when there is no DSML", () => {
    const message = assistant(textPart("nothing to see here"));
    const result = recoverDsmlToolCalls(message, ids);

    expect(result.changed).toBe(false);
    expect(result.message).toBe(message);
  });

  it("ignores non-assistant messages", () => {
    const message = { role: "user", content: [textPart(MANGLED_SINGLE)] };
    expect(recoverDsmlToolCalls(message, ids).changed).toBe(false);
  });

  it("does not mutate the input message", () => {
    const message = assistant(textPart(MANGLED_SINGLE));
    const before = JSON.stringify(message);
    recoverDsmlToolCalls(message, ids);
    expect(JSON.stringify(message)).toBe(before);
  });
});
