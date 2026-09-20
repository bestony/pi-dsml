/**
 * Fixtures are verbatim: MANGLED_* come from real `commandcode` /
 * `deepseek-v4.1-flash` sessions, CANONICAL_* from DeepSeek's published DSML
 * grammar. Do not "tidy" the markers — the exact bars and spacing are the point.
 */

/** Real session text: doubled bars, a space, and a bare `calls` tag. */
export const MANGLED_SINGLE = [
  "I'll check the project setup first.",
  "",
  '<｜｜DSML｜｜ calls>',
  '<｜｜DSML｜｜ invoke name="bash">',
  '<｜｜DSML｜｜ parameter name="command" string="true">ls -la</｜｜DSML｜｜ parameter>',
  "</｜｜DSML｜｜ invoke>",
  "</｜｜DSML｜｜ calls>",
].join("\n");

/** Real session text with two invokes and a shell command full of `&&` and quotes. */
export const MANGLED_MULTI =
  "I'll explore the repository to build a solid mental model before writing `AGENTS.md`. " +
  "Let me start by looking at the structure and key config files.\n\n" +
  '<｜｜DSML｜｜ calls>\n<｜｜DSML｜｜ invoke name="bash">\n' +
  '<｜｜DSML｜｜ parameter name="command" string="true">' +
  'cd /Users/bestony/Developer/pnpm/bestony-pi && ls -la && echo "---GIT---" && ' +
  "git log --oneline -5 2>/dev/null && echo \"---STATUS---\" && git status --short 2>/dev/null && " +
  'echo "---AGENTS---" && ls AGENTS.md 2>/dev/null && echo "done"' +
  "</｜｜DSML｜｜ parameter>\n</｜｜DSML｜｜ invoke>\n" +
  '<｜｜DSML｜｜ invoke name="glob">\n' +
  '<｜｜DSML｜｜ parameter name="pattern" string="true">**/package.json</｜｜DSML｜｜ parameter>\n' +
  "</｜｜DSML｜｜ invoke>\n</｜｜DSML｜｜ calls>";

/** DeepSeek's documented form: single bars, no space, full tag names. */
export const CANONICAL_SINGLE = [
  "Reading the config now.",
  "",
  "<｜DSML｜tool_calls>",
  '<｜DSML｜invoke name="read">',
  '<｜DSML｜parameter name="path" string="true">/tmp/a.txt</｜DSML｜parameter>',
  "</｜DSML｜invoke>",
  "</｜DSML｜tool_calls>",
].join("\n");

/** `string="false"` carries JSON: number, boolean, array, object. */
export const CANONICAL_TYPED = [
  "<｜DSML｜tool_calls>",
  '<｜DSML｜invoke name="demo">',
  '<｜DSML｜parameter name="count" string="false">5</｜DSML｜parameter>',
  '<｜DSML｜parameter name="flag" string="false">true</｜DSML｜parameter>',
  '<｜DSML｜parameter name="items" string="false">["a","b"]</｜DSML｜parameter>',
  '<｜DSML｜parameter name="opts" string="false">{"deep":{"n":1}}</｜DSML｜parameter>',
  '<｜DSML｜parameter name="label" string="true">5</｜DSML｜parameter>',
  "</｜DSML｜invoke>",
  "</｜DSML｜tool_calls>",
].join("\n");

/** Output cut off by the token limit: no closing block tag. */
export const TRUNCATED = [
  "Working on it.",
  "",
  '<｜｜DSML｜｜ calls>',
  '<｜｜DSML｜｜ invoke name="bash">',
  '<｜｜DSML｜｜ parameter name="command" string="true">echo hi</｜｜DSML｜｜ parameter>',
  "</｜｜DSML｜｜ invoke>",
  '<｜｜DSML｜｜ invoke name="bash">',
  '<｜｜DSML｜｜ parameter name="command" string="true">echo trunc',
].join("\n");

/** Documentation, not a call — must survive untouched. */
export const FENCED = [
  "The grammar looks like this:",
  "",
  "```xml",
  "<｜DSML｜tool_calls>",
  '<｜DSML｜invoke name="bash">',
  '<｜DSML｜parameter name="command" string="true">ls</｜DSML｜parameter>',
  "</｜DSML｜invoke>",
  "</｜DSML｜tool_calls>",
  "```",
  "",
  "That is all.",
].join("\n");

export const EOS_TOKEN = "<｜end▁of▁sentence｜>";

export const textPart = (text: string) => ({ type: "text" as const, text });

export const assistant = (...content: unknown[]) => ({
  role: "assistant" as const,
  content,
  stopReason: "stop",
});
