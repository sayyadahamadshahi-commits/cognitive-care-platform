/**
 * assistant.js — chat orchestration: built-in local engine + optional
 * backend-powered AI, with automatic fallback.
 *
 * This mirrors the logic patched into index.html's `Assistant` object.
 * Kept here as a standalone module for projects that split the app into
 * separate files instead of one self-contained HTML page.
 */
const AssistantEngine = {
  history: [], // [{role:'user'|'assistant', content:string}]

  /** Tries the backend; falls back to a local canned reply on any failure. */
  async respond(userText, context, localReplyFn) {
    const useBackend = (localStorage.getItem('cbrain_ai_provider') || 'local') === 'backend';

    if (!useBackend) {
      return { text: localReplyFn(userText), source: 'local' };
    }

    try {
      const answer = await CareAPI.sendMessage(userText, context, this.history);
      this.history.push({ role: 'user', content: userText });
      this.history.push({ role: 'assistant', content: answer });
      this.history = this.history.slice(-20); // bound memory/token usage
      return { text: answer, source: 'backend' };
    } catch (e) {
      console.warn('Backend assistant call failed, falling back to local engine:', e.message);
      const reason = e.code === 'config'
        ? 'the backend has no API key configured'
        : 'the backend could not be reached';
      return {
        text: `${localReplyFn(userText)}\n\n(Note: ${reason}, so this is the built-in assistant's answer.)`,
        source: 'local-fallback',
      };
    }
  },

  resetHistory() {
    this.history = [];
  },
};
