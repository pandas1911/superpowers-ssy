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
import { createUserMessage } from '@deepseek-ai/dsh-llm';
export const name = 'superpowers-primer';
export const inject = ['skills'];
const PRIMER_PLUGIN = 'superpowers-primer';
/**
 * Whether a primer injected by this plugin is still visible on the session's
 * model-visible surface — i.e. present in the durable log and not hidden by
 * compaction. Mirrors the skill catalog's `catalogHistory` scan: newest-last
 * over `agent.session.events`, filtered to visible `surface.nodes`.
 */
function primerVisible(agent) {
    const visible = new Set(agent.session.surface.nodes);
    const events = agent.session.events;
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event.type !== 'user/message')
            continue;
        const source = event.data.source;
        if (source.kind !== 'plugin' || source.plugin !== PRIMER_PLUGIN)
            continue;
        if (visible.has(event.seq))
            return true;
    }
    return false;
}
export function apply(ctx) {
    ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
        const decision = await next();
        if (decision.kind === 'reject')
            return decision;
        // Idempotent: skip if the primer is already visible in durable history
        // (the core carries it into this step's full context) or already in this
        // step's working set. Re-inject only when absent — first step, or after
        // compaction has hidden the durable primer from the visible surface.
        if (primerVisible(agent)
            || decision.messages.some(message => message.source.kind === 'plugin' && message.source.plugin === PRIMER_PLUGIN))
            return decision;
        signal.throwIfAborted();
        const skill = await ctx.skills.get('using-superpowers', {
            cwd: agent.session.header.cwd,
            signal,
            scope: agent,
        });
        // A missing skill (the superpowers catalog is not installed under any
        // ranked root) is a no-op: the plugin loads harmlessly without the
        // catalog and the injection only fires once it is present.
        if (!skill)
            return decision;
        const primer = createUserMessage({
            content: [{
                    type: 'text',
                    text: `<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n${skill.content}\n</EXTREMELY_IMPORTANT>`,
                }],
            source: { kind: 'plugin', plugin: PRIMER_PLUGIN },
        });
        return { kind: 'enter', messages: [...decision.messages, primer] };
    });
}
