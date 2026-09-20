# pi-dsml

A [pi](https://github.com/earendil-works/pi) package that executes DeepSeek **DSML** tool calls
which arrive as plain assistant text.

## The problem

Some gateways serve DeepSeek models without native tool calling. The model falls back to its
own DSML grammar and writes the call into the response body:

```
I'll check the project setup first.

<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="bash">
<｜｜DSML｜｜ parameter name="command" string="true">ls -la</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
```

Pi receives a message with `text` blocks and no `toolCall` blocks, so it runs nothing — while the
model carries on as if the tool had answered. The turn derails from there.

`pi-dsml` parses that text back into real tool calls at `message_end`, which is early enough that
pi's agent loop still executes them.

## Install

```bash
pi install npm:pi-dsml
```

Or, for local development:

```bash
pi -e /path/to/pi-dsml/extensions/index.ts
```

## Grammar coverage

Both the documented form and the mangled form real gateways emit:

| | Block | Invoke | Parameter |
|---|---|---|---|
| Canonical | `<｜DSML｜tool_calls>` | `<｜DSML｜invoke name="x">` | `<｜DSML｜parameter name="k" string="true">` |
| Mangled | `<｜｜DSML｜｜ calls>` | `<｜｜DSML｜｜ invoke name="x">` | `<｜｜DSML｜｜ parameter name="k" string="true">` |

The mangled form comes from re-decoding the special tokens: bars double up, a space appears where
`tool_` should be, and the block tag is left as a bare `calls`. `<｜end▁of▁sentence｜>` is stripped
too.

Per the spec, `string="true"` means a raw string and `string="false"` means a JSON value
(number, boolean, array, object).

## Behaviour

- **Unknown tool names are recovered as-is.** Models sometimes invent names (`read_file`,
  `explore`, `Bash`). Pi answers those with its own `Tool X not found` result, which the model
  reads and corrects on the next turn — a better feedback loop than silently dropping the call.
- **Messages that already have native tool calls** only get the leaked text cleaned up; the parsed
  copies are discarded so nothing runs twice.
- **Fenced code is never touched**, so documenting the grammar cannot trigger an execution.
- **Truncated blocks** still yield whatever complete calls arrived before the cut.
- **Thinking blocks** are cleaned the same way as text.
- **While streaming**, a markdown transformer hides DSML spans behind `⟨tool call⟩`, so the
  terminal does not fill with raw markers.

Text with no DSML in it short-circuits immediately, so models with working native tool calls pay
nothing.

## Configuration

Everything has a default; the file is optional. Create
`~/.pi/agent/extensions/pi-dsml.json`:

```json
{
  "enabled": true,
  "models": ["deepseek"],
  "hideWhileStreaming": true,
  "debug": false
}
```

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Turn the extension off without uninstalling it. |
| `models` | *(unset)* | Case-insensitive regex fragments. When set, only matching model ids are touched; unset means every model. |
| `hideWhileStreaming` | `true` | Register the display-only markdown transformer. |
| `debug` | `false` | Log `[pi-dsml] recovered=… stripped=…` to stderr. `PI_DSML_DEBUG=1` does the same. |

## Development

```bash
npm install
npm run check   # tsc --noEmit + vitest
```

`test/replay.test.ts` replays the real leaked messages found in `~/.pi/agent/sessions`, and skips
itself when that history is not present.

## License

MIT
