import { describe, expect, it } from "vitest";
import { DEFAULT_PLACEHOLDER, redactDsml } from "../src/display.ts";
import { FENCED, MANGLED_MULTI, MANGLED_SINGLE } from "./fixtures.ts";

describe("redactDsml", () => {
  it("replaces a complete block with a placeholder", () => {
    expect(redactDsml(MANGLED_SINGLE)).toBe(
      `I'll check the project setup first.\n\n${DEFAULT_PLACEHOLDER}`,
    );
  });

  it("hides the tail of a block that is still streaming", () => {
    const partial = MANGLED_SINGLE.slice(0, MANGLED_SINGLE.indexOf("ls -la") + 3);
    const rendered = redactDsml(partial);

    expect(rendered).not.toContain("DSML");
    expect(rendered.endsWith(DEFAULT_PLACEHOLDER)).toBe(true);
  });

  it("never leaks a marker from a multi-invoke block", () => {
    expect(redactDsml(MANGLED_MULTI)).not.toContain("DSML");
  });

  it("leaves a fenced example readable", () => {
    expect(redactDsml(FENCED)).toBe(FENCED);
  });

  it("passes ordinary markdown through unchanged", () => {
    const markdown = "# Title\n\nSome **text** and `code`.";
    expect(redactDsml(markdown)).toBe(markdown);
  });
});
