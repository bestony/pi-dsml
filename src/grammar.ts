/**
 * DSML marker grammar — the single source of truth for every regex in this package.
 *
 * DeepSeek's canonical tool-call grammar uses single full-width bars and complete
 * tag names:
 *
 *   <｜DSML｜tool_calls>
 *   <｜DSML｜invoke name="bash">
 *   <｜DSML｜parameter name="command" string="true">ls</｜DSML｜parameter>
 *   </｜DSML｜invoke>
 *   </｜DSML｜tool_calls>
 *
 * Gateways that re-decode the special tokens emit a mangled variant instead —
 * doubled bars, a stray space where `tool_` should be, and a bare `calls` tag:
 *
 *   <｜｜DSML｜｜ calls>
 *   <｜｜DSML｜｜ invoke name="bash">
 *   <｜｜DSML｜｜ parameter name="command" string="true">ls</｜｜DSML｜｜ parameter>
 *
 * One marker fragment has to swallow both. The trailing `\s*` is what absorbs the
 * space in `｜｜DSML｜｜ calls`, and the `calls` alternative is what matches the
 * truncated tag name that space leaves behind.
 */

/** Full-width (U+FF5C) or ASCII vertical bar. */
const BAR = "[｜|]";

/** `｜DSML｜`, `｜｜DSML｜｜ `, `|DSML|`, … including any trailing whitespace. */
export const MARKER = `(?:${BAR}{1,2}\\s*DSML\\s*${BAR}{1,2}\\s*)`;

/** Outer block tag. `calls` is the mangled form of `tool_calls`. */
const BLOCK_TAG = "(?:tool_calls|function_calls|calls)";

/** Every tag name that can carry a DSML marker, for dangling-marker cleanup. */
const ANY_TAG = "(?:tool_calls|function_calls|calls|invoke|parameter)";

export const blockOpenRe = (): RegExp => new RegExp(`<${MARKER}${BLOCK_TAG}>`, "giu");

export const blockCloseRe = (): RegExp => new RegExp(`</${MARKER}${BLOCK_TAG}>`, "giu");

export const invokeOpenRe = (): RegExp =>
  new RegExp(`<${MARKER}invoke\\s+name=["']([^"']+)["']\\s*>`, "giu");

export const invokeCloseRe = (): RegExp => new RegExp(`</${MARKER}invoke>`, "giu");

export const parameterRe = (): RegExp =>
  new RegExp(
    `<${MARKER}parameter\\s+name=["']([^"']+)["']` +
      `(?:\\s+string=["']?(true|false)["']?)?\\s*>` +
      `([\\s\\S]*?)</${MARKER}parameter>`,
    "giu",
  );

/** Any DSML tag at all — used to strip fragments that never formed a full call. */
export const danglingMarkerRe = (): RegExp =>
  new RegExp(`</?${MARKER}${ANY_TAG}(?:\\s+[^>\\n]*)?>?`, "giu");

/** `<｜end▁of▁sentence｜>` (U+2581 separator) and its degraded spellings. */
export const endOfSentenceRe = (): RegExp =>
  new RegExp(`<${BAR}{1,2}\\s*end[▁_\\s]?of[▁_\\s]?sentence\\s*${BAR}{1,2}>`, "giu");

/** Cheap pre-check: skip all parsing when the text cannot contain a DSML tag. */
export const looksLikeDsml = (text: string): boolean =>
  /DSML|end[▁_]of[▁_]sentence/i.test(text);
