/**
 * Display-only redaction for the TUI.
 *
 * Recovery happens at `message_end`, but the text streams in long before that,
 * so without this the terminal fills with raw DSML markers on every turn. This
 * runs on partial text too, where the block is usually still unclosed — in that
 * case everything from the opening marker onward is hidden, since it is all
 * going to become a tool call anyway.
 */

import {
  blockCloseRe,
  blockOpenRe,
  danglingMarkerRe,
  endOfSentenceRe,
  looksLikeDsml,
} from "./grammar.ts";

export const DEFAULT_PLACEHOLDER = "⟨tool call⟩";

export function redactDsml(markdown: string, placeholder = DEFAULT_PLACEHOLDER): string {
  if (!looksLikeDsml(markdown)) return markdown;

  let result = "";
  let cursor = 0;

  for (const open of markdown.matchAll(blockOpenRe())) {
    if (open.index === undefined || open.index < cursor) continue;
    if (insideCodeFence(markdown, open.index)) continue;

    result += markdown.slice(cursor, open.index) + placeholder;

    const close = findFrom(markdown, blockCloseRe(), open.index + open[0].length);
    if (close === undefined) return result;  // Unclosed: the rest is still streaming in.
    cursor = close;
  }

  result += markdown.slice(cursor);

  // Leftover markers are only safe to scrub when no fence could be holding a
  // deliberate DSML example.
  if (result.includes("```")) return result;
  return result.replace(danglingMarkerRe(), "").replace(endOfSentenceRe(), "");
}

function findFrom(text: string, re: RegExp, from: number): number | undefined {
  const match = re.exec(text.slice(from));
  return match ? from + match.index + match[0].length : undefined;
}

function insideCodeFence(text: string, index: number): boolean {
  const fences = text.slice(0, index).match(/```/g);
  return fences !== null && fences.length % 2 === 1;
}
