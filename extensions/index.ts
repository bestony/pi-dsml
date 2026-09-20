/**
 * pi-dsml — execute DeepSeek DSML tool calls that arrive as plain text.
 *
 * Some gateways serve DeepSeek models without native tool calling, so the model
 * emits its DSML tool-call grammar into the assistant text instead. Pi sees a
 * message with no `toolCall` blocks and runs nothing, while the model believes
 * it called a tool. This extension parses that text back into real tool calls at
 * `message_end` — early enough that pi's agent loop still executes them.
 */

import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  appliesToModel,
  loadConfig,
  recoverDsmlToolCalls,
  redactDsml,
  type AssistantMessageLike,
} from "../src/index.ts";

export default function (pi: ExtensionAPI): void {
  const config = loadConfig(join(getAgentDir(), "extensions", "pi-dsml.json"));
  if (!config.enabled) return;

  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;
    if (!appliesToModel(config, safeModelId(ctx))) return;

    const result = recoverDsmlToolCalls(event.message as unknown as AssistantMessageLike);
    if (!result.changed) return;

    if (config.debug) {
      const names = result.recovered.map((call) => call.name).join(",") || "none";
      process.stderr.write(`[pi-dsml] recovered=${names} stripped=${result.stripped}\n`);
    }

    return { message: result.message as never };
  });

  if (config.hideWhileStreaming) {
    pi.registerMarkdownTransformer((markdown, { messageType }) => {
      if (messageType !== "assistant" && messageType !== "assistant-thinking") return markdown;
      return redactDsml(markdown);
    });
  }
}

/** `ctx.model` is a getter that can throw before a model is resolved. */
function safeModelId(ctx: { model?: { id?: string } }): string | undefined {
  try {
    return ctx.model?.id;
  } catch {
    return undefined;
  }
}
