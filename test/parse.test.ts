import { describe, expect, it } from "vitest";
import { parseDsml, stripRanges } from "../src/parse.ts";
import {
  CANONICAL_SINGLE,
  CANONICAL_TYPED,
  EOS_TOKEN,
  FENCED,
  MANGLED_MULTI,
  MANGLED_SINGLE,
  TRUNCATED,
} from "./fixtures.ts";

const strip = (text: string) => {
  const { ranges } = parseDsml(text);
  return stripRanges(text, ranges);
};

describe("parseDsml", () => {
  it("parses the mangled gateway form (doubled bars, space, bare `calls`)", () => {
    const { calls } = parseDsml(MANGLED_SINGLE);
    expect(calls).toEqual([{ name: "bash", arguments: { command: "ls -la" } }]);
  });

  it("parses DeepSeek's canonical form", () => {
    const { calls } = parseDsml(CANONICAL_SINGLE);
    expect(calls).toEqual([{ name: "read", arguments: { path: "/tmp/a.txt" } }]);
  });

  it("keeps multiple invokes in source order", () => {
    const { calls } = parseDsml(MANGLED_MULTI);
    expect(calls.map((call) => call.name)).toEqual(["bash", "glob"]);
    expect(calls[1]?.arguments).toEqual({ pattern: "**/package.json" });
  });

  it("preserves a raw shell command byte for byte", () => {
    const { calls } = parseDsml(MANGLED_MULTI);
    const command = calls[0]?.arguments.command;
    expect(command).toContain('&& echo "---GIT---" &&');
    expect(command).toContain("2>/dev/null");
    expect(command).not.toContain("DSML");
  });

  it("decodes string=\"false\" as JSON and string=\"true\" as text", () => {
    const { calls } = parseDsml(CANONICAL_TYPED);
    expect(calls[0]?.arguments).toEqual({
      count: 5,
      flag: true,
      items: ["a", "b"],
      opts: { deep: { n: 1 } },
      label: "5",
    });
  });

  it("preserves raw string content except for tag-adjacent newlines", () => {
    const text = [
      "<｜DSML｜tool_calls>",
      '<｜DSML｜invoke name="bash">',
      '<｜DSML｜parameter name="command" string="true">',
      "printf 'a > b && c & d'  \n  ",
      "</｜DSML｜parameter>",
      "</｜DSML｜invoke>",
      "</｜DSML｜tool_calls>",
    ].join("\n");

    expect(parseDsml(text).calls[0]?.arguments.command).toBe("printf 'a > b && c & d'  \n  ");
  });

  it("recovers the complete call from a truncated block", () => {
    const { calls } = parseDsml(TRUNCATED);
    expect(calls).toEqual([{ name: "bash", arguments: { command: "echo hi" } }]);
    expect(strip(TRUNCATED)).toBe("Working on it.");
  });

  it("ignores a block inside a code fence", () => {
    expect(parseDsml(FENCED).calls).toEqual([]);
    expect(strip(FENCED)).toBe(FENCED);
  });

  it("strips the end-of-sentence token", () => {
    expect(strip(`done${EOS_TOKEN}`)).toBe("done");
    expect(strip("done<｜｜end▁of▁sentence｜｜>")).toBe("done");
  });

  it("recognizes lowercase DSML markers", () => {
    const text = [
      "<｜dsml｜tool_calls>",
      '<｜dsml｜invoke name="bash">',
      '<｜dsml｜parameter name="command">echo ok</｜dsml｜parameter>',
      "</｜dsml｜invoke>",
      "</｜dsml｜tool_calls>",
    ].join("\n");

    expect(parseDsml(text).calls).toEqual([{ name: "bash", arguments: { command: "echo ok" } }]);
  });

  it("returns nothing for text without DSML", () => {
    expect(parseDsml("just a normal reply with <tags> and `code`")).toEqual({
      calls: [],
      ranges: [],
    });
  });

  it("strips a stray marker that never formed a call", () => {
    expect(strip("before <｜｜DSML｜｜ invoke name=\"bash\"> after")).toBe("before  after");
  });
});

describe("stripRanges", () => {
  it("leaves only the prose", () => {
    expect(strip(MANGLED_SINGLE)).toBe("I'll check the project setup first.");
  });

  it("collapses the blank lines the block leaves behind", () => {
    expect(strip(MANGLED_MULTI)).not.toMatch(/\n{3}/);
  });
});
