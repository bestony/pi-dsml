/**
 * Parse DSML tool-call blocks out of assistant text.
 *
 * Returns the recovered calls plus every character range that should be removed
 * from the text, so a caller can both execute the calls and leave a clean
 * transcript behind.
 */

import {
  blockCloseRe,
  blockOpenRe,
  danglingMarkerRe,
  endOfSentenceRe,
  invokeCloseRe,
  invokeOpenRe,
  looksLikeDsml,
  parameterRe,
} from "./grammar.ts";

export interface DsmlToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface Range {
  start: number;
  end: number;
}

export interface ParseResult {
  calls: DsmlToolCall[];
  /** Ranges to delete from the text, sorted and non-overlapping. */
  ranges: Range[];
}

const EMPTY: ParseResult = { calls: [], ranges: [] };

export function parseDsml(text: string): ParseResult {
  if (!looksLikeDsml(text)) return EMPTY;

  const calls: DsmlToolCall[] = [];
  const ranges: Range[] = [];

  for (const open of matchAll(text, blockOpenRe())) {
    if (insideCodeFence(text, open.start)) continue;

    const bodyStart = open.end;
    const close = firstMatch(text, blockCloseRe(), bodyStart);
    // A truncated response can end mid-block. Parse only up to the last
    // `</invoke>`, so a half-written call is never recovered, but strip all the
    // way to the end — nothing after an unclosed block is prose.
    const bodyEnd = close
      ? close.start
      : (lastMatch(text, invokeCloseRe(), bodyStart)?.end ?? bodyStart);

    calls.push(...parseInvokes(text.slice(bodyStart, bodyEnd)));
    ranges.push({ start: open.start, end: close ? close.end : text.length });
  }

  // Markers that never formed a usable block (stray opens, orphan closers) are
  // still noise in the transcript.
  for (const marker of matchAll(text, danglingMarkerRe())) {
    if (insideCodeFence(text, marker.start)) continue;
    ranges.push(marker);
  }

  for (const eos of matchAll(text, endOfSentenceRe())) {
    if (insideCodeFence(text, eos.start)) continue;
    ranges.push(eos);
  }

  if (calls.length === 0 && ranges.length === 0) return EMPTY;
  return { calls, ranges: mergeRanges(ranges) };
}

/** Remove `ranges` from `text` and tidy up the whitespace they leave behind. */
export function stripRanges(text: string, ranges: Range[]): string {
  let result = "";
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) result += text.slice(cursor, range.start);
    cursor = Math.max(cursor, range.end);
  }
  result += text.slice(cursor);
  return result
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseInvokes(body: string): DsmlToolCall[] {
  const calls: DsmlToolCall[] = [];
  const opens = matchAll(body, invokeOpenRe());

  for (let i = 0; i < opens.length; i++) {
    const open = opens[i]!;
    const name = open.groups[0]?.trim();
    if (!name) continue;

    // Prefer the real closing tag; otherwise stop at the next invoke (or the end
    // of the block) so a truncated tail does not swallow the following call.
    const close = firstMatch(body, invokeCloseRe(), open.end);
    const nextOpen = opens[i + 1];
    const end =
      close && (!nextOpen || close.start < nextOpen.start)
        ? close.start
        : (nextOpen?.start ?? body.length);

    calls.push({ name, arguments: parseParameters(body.slice(open.end, end)) });
  }

  return calls;
}

function parseParameters(body: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (const param of matchAll(body, parameterRe())) {
    const key = param.groups[0]?.trim();
    if (!key) continue;
    args[key] = decodeValue(param.groups[2] ?? "", param.groups[1]);
  }

  return args;
}

/**
 * `string="false"` means the value is JSON; anything else means a raw string.
 * Only the newline that hugs each tag is removed — the value itself (shell
 * heredocs, indentation, trailing spaces) is preserved verbatim.
 */
function decodeValue(raw: string, stringAttr: string | undefined): unknown {
  const value = raw.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  if (stringAttr !== "false") return value;

  try {
    return JSON.parse(value.trim());
  } catch {
    return value;
  }
}

interface Match extends Range {
  groups: (string | undefined)[];
}

function matchAll(text: string, re: RegExp): Match[] {
  const matches: Match[] = [];
  for (const match of text.matchAll(re)) {
    if (match.index === undefined || match[0].length === 0) continue;
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      groups: match.slice(1),
    });
  }
  return matches;
}

function firstMatch(text: string, re: RegExp, from: number): Match | undefined {
  return matchAll(text.slice(from), re).map((m) => offset(m, from))[0];
}

function lastMatch(text: string, re: RegExp, from: number): Match | undefined {
  const matches = matchAll(text.slice(from), re);
  return matches.length > 0 ? offset(matches[matches.length - 1]!, from) : undefined;
}

function offset(match: Match, by: number): Match {
  return { start: match.start + by, end: match.end + by, groups: match.groups };
}

/** Sort, drop ranges contained in earlier ones, and coalesce overlaps. */
function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Range[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      continue;
    }
    merged.push({ ...range });
  }

  return merged;
}

/** An odd number of fences before `index` means we are inside a code block. */
function insideCodeFence(text: string, index: number): boolean {
  const fences = text.slice(0, index).match(/```/g);
  return fences !== null && fences.length % 2 === 1;
}
