import { describe, expect, it } from "vitest";
import { appliesToModel, DEFAULT_CONFIG, loadConfig, normalizeConfig } from "../src/config.ts";

describe("normalizeConfig", () => {
  it("falls back to defaults for junk input", () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig("nope")).toEqual(DEFAULT_CONFIG);
  });

  it("keeps only valid regex patterns", () => {
    const config = normalizeConfig({ models: ["deepseek", "(unclosed", 42] });
    expect(config.models).toEqual(["deepseek"]);
  });

  it("drops an empty model list so every model still applies", () => {
    expect(normalizeConfig({ models: [] }).models).toBeUndefined();
  });
});

describe("loadConfig", () => {
  it("returns defaults when the file does not exist", () => {
    expect(loadConfig("/nonexistent/pi-dsml.json")).toEqual(DEFAULT_CONFIG);
  });
});

describe("appliesToModel", () => {
  const config = { enabled: true, hideWhileStreaming: true, debug: false };

  it("applies to every model when no list is configured", () => {
    expect(appliesToModel(config, "anthropic/claude")).toBe(true);
    expect(appliesToModel(config, undefined)).toBe(true);
  });

  it("honours an allowlist case-insensitively", () => {
    const scoped = { ...config, models: ["deepseek"] };
    expect(appliesToModel(scoped, "deepseek/DeepSeek-V4.1-flash")).toBe(true);
    expect(appliesToModel(scoped, "anthropic/claude")).toBe(false);
  });

  it("never applies when disabled", () => {
    expect(appliesToModel({ ...config, enabled: false }, "deepseek")).toBe(false);
  });
});
