/**
 * Native DeepSeek Harness primer for the superpowers skill library.
 *
 * Upstream superpowers ships a Claude Code `SessionStart` hook that injects the
 * `using-superpowers` skill body into every new session. This plugin performs
 * the equivalent injection on the `agent/pre-step` extension point.
 *
 * Why `agent/pre-step` rather than `agent/session-start`: session-start is a
 * one-shot event, so a listener whose `apply()` runs late — for example
 * because `inject: ['skills']` defers it until the skills service is ready,
 * which can land after the event has already fired for a fast-starting session
 * — misses it forever for that session. `agent/pre-step` is a recurring
 * extension point that fires before every step, so late registration merely
 * delays the primer to the next step instead of losing it, and it is the same
 * mechanism the built-in skill catalog uses to land in the first step.
 *
 * Compaction-aware idempotency (mirrors the skill catalog): the injected primer
 * is a durable `user/message`, so once present the core carries it forward into
 * every later step's full context on its own — the handler does not need to
 * re-add it. Each pre-step the handler asks `primerVisible(agent)`, which scans
 * the durable session events for the newest primer that is still on the
 * model-visible surface (`agent.session.surface.nodes`). If one is visible, the
 * handler does nothing; if none is visible — the first step, or after
 * compaction has hidden the durable primer from the surface — it re-injects.
 * This means the primer survives compaction without per-step duplication.
 *
 * @module @local/dsh-superpowers-primer
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "superpowers-primer";
export declare const inject: string[];
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'plugin:superpowers-primer': {
            kind: 'plugin:superpowers-primer';
        };
    }
}
export declare function apply(ctx: Context): void;
