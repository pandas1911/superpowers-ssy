## dsh (DeepSeek Harness) — Tool Reference

Platform-specific notes for running superpowers skills on dsh. Trust your
actual tool list over any table here — including this one — when they
disagree. A deployment may rename `subagent`/`workflow` via config, and any
tool may be absent from a given profile.

## Tool surface

| Capability | Tool name(s) |
|---|---|
| Shell | `bash` (or `pwsh` on Windows) |
| Filesystem | `read`, `read_image`, `write`, `edit`, `str_replace_editor` |
| Search | `grep`, `glob` |
| Subagents | `subagent` (spawn), `subagent_fork` (fixed-route variant), `send_message`, `interrupt_agent`, `list_agents`, `list_subagent_models` (model-selection deployments) |
| Todos | `todo_write` |
| Web | `web_search`, `web_fetch` |
| Skills | `skill` |
| Goals | `get_goal`, `create_goal`, `update_goal` |
| Workflows | `workflow`, `ralph` |
| Background jobs | `job_output`, `job_list`, `job_kill` |
| Plan mode | `exit_plan_mode` |
| Ask user | `ask_user_question` |
| PTC transport | `run_code` (0.1.6+; reserved registry transport under `mode: ptc`/`both`) |
| Plugin management | `plugin_manager` (0.1.6+; profile-wide plugin/bundle operations) |
| Opt-in extras | `terminal_open`/`_read`/`_send`/`_signal`/`_list`/`_close`, `schedule_create`/`_list`/`_delete`, `session_search`, `session_trace`, `session_event_*`, `lsp`, `present`, `list_mcp_resources`, `read_mcp_resource` |

dsh has **no native worktree tool** — see below.

## Worktrees — use the git fallback

`using-git-worktrees` Step 1a prefers a native worktree tool; dsh has none
(no `enter_worktree`/`exit_worktree`), so always take **Step 1b**: create and
manage worktrees with `git worktree add` / `git worktree remove` via the
`bash` tool. Everything downstream — `finishing-a-development-branch` and
the worktree isolation in `subagent-driven-development` — flows from that git
worktree and works unchanged.

## Subagent dispatch and lifecycle

Skills like `dispatching-parallel-agents` and `subagent-driven-development`
dispatch subagents. On dsh:

- **Spawn** a fresh-context subagent with the `subagent` tool (default name;
  deployments can rename it via config).
- **Message a running subagent again** with `send_message` — never dispatch
  a fresh implementer on the theory that a spawned agent cannot be reached.
  Use `send_message` for fix rounds and follow-ups, exactly as you would
  resume an implementer.
- **List** outstanding subagents with `list_agents`.
- **Collect** results without a dedicated tool: a foreground call (the
  `one-shot` default, or `run_in_background: false`) waits and returns the
  child's final text; a background `one-shot` run returns a job id collected
  with `job_output` and stopped with `job_kill`; a `continuable` background
  run returns a durable child id and the runtime delivers a settlement notice
  when the child ends.

Trust the tool descriptions for exact semantics (what context a fresh spawn
receives, eviction behavior). The core discipline from
`subagent-driven-development` — one implementer, resumed via message rather
than re-dispatched — maps directly onto `subagent` + `send_message`.

## Skill invocation and the primer

Two entry points, both available on dsh:

- **`skill` tool** — call `skill` with `{ name: "<skill-name>" }` to load a
  skill's full instructions as tool output.
- **`/skill-name` slash gesture** — type `/skill-name` as the first line of a
  user message; the harness injects the skill content on the next pre-step.
  This is the only entry point for `disable-model-invocation` skills.

The `using-superpowers` primer is auto-injected on the first step of every
session by the `superpowers-primer` plugin — you do not need to load it
yourself.

## Skill install path

Personal skills live in `~/.dsh/skills/` (the `user-dsh` root, rank 400;
lower rank wins on name collisions). `~/.agents/skills/` (rank 500) is also
recognized as a cross-runtime alias. See `writing-skills` for authoring.

## Plan mode

dsh has plan mode: write the plan in markdown, then call `exit_plan_mode` to
present it for user review. The `exit_plan_mode` tool stays registered
whether or not plan mode is active, so its presence does not mean you are in
plan mode. `using-superpowers`'s "Before entering plan mode: brainstorm
first" rule applies directly.

## Environment Detection

The same read-only git commands work on dsh as on Codex — run them via the
`bash` tool before creating worktrees or finishing branches:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

- `GIT_DIR != GIT_COMMON` → already in a linked worktree (skip creation)
- `BRANCH` empty → detached HEAD (cannot branch/push/PR from here)

See `using-git-worktrees` Step 0 and `finishing-a-development-branch` Step 1
for how each skill uses these signals.
