# chuck.e131

Kilroy app that bridges Kilroy swarms to the **e131test** E1.31 LED matrix gateway server.
It registers five wf_agent webhook tools. An AI agent (or any swarm participant) sends a
chat message to the appropriate wf_agent and the webhook script translates it into an HTTP
call to the gateway. The agent replies with `OK`, `ERR`, or plain-text data.

## Architecture

```
Swarm message  →  wf_agent (chuck.e131.webhooks)  →  HTTP  →  e131test gateway  →  E1.31  →  LED matrix
                                                    ←  OK / ERR / frame data
```

- **Gateway URL:** configured in the wf_agent palette block via `wf_webhook_args.host` (default: `http://localhost:3131`)
- **Webhook diagram alias:** `chuck.e131.webhooks`

---

## Configuration vs. swarm message format

### Gateway host (static config)

The gateway URL is **not** passed in swarm messages. It is baked into the wf_agent palette
block via the `wf_webhook_args` field:

```json
{ "host": "http://localhost:3131" }
```

This value is injected into every webhook invocation automatically by the wf_agent
infrastructure. To point a block at a different gateway, edit `wf_webhook_args.host` in the
palette block before deploying the pipeline.

### Swarm message format (operation parameters)

The swarm message text carries only the operation-specific parameters. The message text is
parsed in this priority order:

1. The message text itself parsed as a JSON object
2. Key/value hints extracted from plain text (`key: value` or `key=value`)

The simplest and most reliable approach is to send **JSON as the message text**:

```json
{ "<param>": <value>, ... }
```

Important: JSON must use straight ASCII quotes (`"`), not typographic smart quotes (`“”`).

Valid:
```text
{"x":6,"y":6,"color":"008080"}
```

Invalid:
```text
{“x”:6,“y”:6,“color”:“008080”}
```

---

## Tools

### `e131_set_pixel`

Sets a single pixel to a color.

| Message parameter | Type | Default | Description |
|-------------------|------|---------|-------------|
| `x` | integer 0–7 | `0` | Column |
| `y` | integer 0–7 | `0` | Row |
| `color` | string or integer | `ff0000` | 6-digit hex (`ff0000`), `#ff0000`, `0xff0000`, or 24-bit integer |

**Accepted formats:**

JSON:
```json
{ "x": 3, "y": 5, "color": "00ff00" }
```

Comma-separated (positional: `x, y, color`):
```
3,5,00ff00
```

**Response:** `OK` or `ERR`

---

### `e131_fill`

Fills the entire matrix with a single color.

| Message parameter | Type | Default | Description |
|-------------------|------|---------|-------------|
| `color` | string or integer | `000000` | 6-digit hex, `#rrggbb`, `0xrrggbb`, or 24-bit integer |

**Accepted formats:**

JSON:
```json
{ "color": "0000ff" }
```

Comma-separated (positional: `color`):
```
0000ff
```

**Response:** `OK` or `ERR`

---

### `e131_set_delay`

Sets the interval between E1.31 packet transmissions. The gateway continuously re-sends the
current frame to the LED device at this rate. Lower values give smoother animations; higher
values reduce network traffic.

| Message parameter | Type | Default | Range | Description |
|-------------------|------|---------|-------|-------------|
| `delay` | integer | `100` | 10–5000 | Frame send interval in milliseconds |

**Accepted formats:**

JSON:
```json
{ "delay": 50 }
```

Comma-separated (positional: `delay`):
```
50
```

**Response:** `OK` or `ERR`

---

### `e131_draw_frame`

Writes a complete 8×8 frame at once. The frame is an 8×8 array of 24-bit RGB values
(row-major: `frame[x][y]`). Each cell can be a hex string (`"rrggbb"`, `"#rrggbb"`,
`"0xrrggbb"`) or an integer (`0` to `16777215`). Use `0` or `"000000"` for black (off).

| Message parameter | Type | Default | Description |
|-------------------|------|---------|-------------|
| `frame` | array | all zeros | 8-element array of 8-element arrays of hex strings or 24-bit integers |

**Color encoding:** each cell may be hex (`"ff0000"`, `"#ff0000"`, `"0xff0000"`) or integer (`16711680`).
Common values: `16711680` = red (`0xff0000`), `65280` = green, `255` = blue, `0` = off.

**Example message text:**
```json
{
  "frame": [
    ["ff0000", 0, 0, 0, 0, 0, 0, 0],
    [0, "ff0000", 0, 0, 0, 0, 0, 0],
    [0, 0, "ff0000", 0, 0, 0, 0, 0],
    [0, 0, 0, "ff0000", 0, 0, 0, 0],
    [0, 0, 0, 0, "ff0000", 0, 0, 0],
    [0, 0, 0, 0, 0, "ff0000", 0, 0],
    [0, 0, 0, 0, 0, 0, "ff0000", 0],
    [0, 0, 0, 0, 0, 0, 0, "ff0000"]
  ]
}
```

**Response:** `OK` or `ERR`

---

### `e131_get_frame`

Returns the current in-memory frame buffer from the gateway (what was last written — the
gateway does not read back state from the hardware).

No message parameters required — send `{}` or an empty message.

**Response:** JSON string of the 8×8 frame — `{"frame":[[r,g,b,...],...]}`  — or `ERR`.

---

## AI palette

Open the manager AI button to load the palette page. Each block is pre-populated with
default `wf_webhook_args` values (including `host`) and can be dragged into any pipeline or
swarm diagram. To target a different gateway, edit `wf_webhook_args.host` in the block
properties before saving the pipeline.

Blocks connect to the `chuck.e131.webhooks` diagram on the running Kilroy server.

---

## Using With `ai_agent` In A Pipeline

The intended pattern is:

```text
user/chat input → ai_agent → shared tool swarm → chuck.e131 wf_agent blocks → LED matrix
```

The `ai_agent` emits a single slash command per response. All chuck.e131 wf_agent blocks
listen on the same swarm and self-filter: each only acts on its own slash command and ignores
all others. The gateway URL is configured once in each block's `wf_webhook_args.host` — it
is never part of the swarm message.

### Recommended slash commands

Safe copy (preferred for quick manual testing):

- `/e131_set_pixel 6,6,008080`
- `/e131_fill 0000ff`
- `/e131_set_delay 50`

- `/e131_set_pixel 1,2,ff0000` or `/e131_set_pixel {"x":1,"y":2,"color":"ff0000"}`
- `/e131_fill 0000ff` or `/e131_fill {"color":"0000ff"}`
- `/e131_set_delay 50` or `/e131_set_delay {"delay":50}`
- `/e131_draw_frame {"frame":[["ff0000",0,0,0,0,0,0,0],[0,"ff0000",0,0,0,0,0,0],[0,0,"ff0000",0,0,0,0,0],[0,0,0,"ff0000",0,0,0,0],[0,0,0,0,"ff0000",0,0,0],[0,0,0,0,0,"ff0000",0,0],[0,0,0,0,0,0,"ff0000",0],[0,0,0,0,0,0,0,"ff0000"]]}`
- `/e131_get_frame {}`

Each chuck.e131 webhook now self-filters on its own slash command. If a message starts with a
different slash command, that tool ignores it and publishes nothing. If no slash command is
present, the tool still accepts the message for backward compatibility.

### Regex routing

If you use regex match blocks upstream, match on the leading command:

- `^/e131_set_pixel\b`
- `^/e131_fill\b`
- `^/e131_set_delay\b`
- `^/e131_draw_frame\b`
- `^/e131_get_frame\b`

This gives you two layers of protection:

1. The regex block routes to the correct branch.
2. The webhook script ignores any slash-command message not meant for it.

### Recommended `ai_agent` system prompt

Use this system prompt for the LLM that will control the matrix:

```text
You control an 8x8 RGB LED matrix through five slash-command tools.

When you want to change the display, output exactly one tool command as the entire reply.
Do not add explanations, markdown, prose, code fences, or any text before or after the command.

Available commands:
/e131_set_pixel <x>,<y>,<rrggbb>
/e131_fill <rrggbb>
/e131_set_delay <ms>
/e131_draw_frame {"frame":[[<rrggbb-or-24-bit-int>,...8 cols],...8 rows]}
/e131_get_frame {}

Rules:
- For set_pixel, fill, and set_delay, use the short comma-separated format above. JSON is also accepted (e.g. {"x":3,"y":4,"color":"ff0000"}).
- color must be a 6-digit lowercase hex RGB string with no # prefix (e.g. ff0000).
- For draw_frame, frame must be an 8x8 array where each cell is either a hex RGB string (rrggbb, #rrggbb, or 0xrrggbb) or a 24-bit integer. Example values: red=ff0000 (or 16711680), green=00ff00 (or 65280), blue=0000ff (or 255), black=000000 (or 0).
- x and y must be integers from 0 to 7.
- Use /e131_fill for solid full-screen colors.
- Use /e131_set_pixel only for single-pixel edits.
- Use /e131_draw_frame for patterns, icons, text-like shapes, and multi-pixel scenes.
- Use /e131_get_frame only when you need to inspect current state.
- If asked for an animation speed or refresh rate, use /e131_set_delay.
- Never emit more than one slash command in a single response.
- If the request is impossible or ambiguous, prefer a simple safe display command such as a black fill or a basic colored pattern rather than asking a question.

Examples:
/e131_fill 0000ff
/e131_set_pixel 3,4,ff0000
/e131_draw_frame {"frame":[["ff0000",0,0,0,0,0,0,0],[0,"ff0000",0,0,0,0,0,0],[0,0,"ff0000",0,0,0,0,0],[0,0,0,"ff0000",0,0,0,0],[0,0,0,0,"ff0000",0,0,0],[0,0,0,0,0,"ff0000",0,0],[0,0,0,0,0,0,"ff0000",0],[0,0,0,0,0,0,0,"ff0000"]]}
```

