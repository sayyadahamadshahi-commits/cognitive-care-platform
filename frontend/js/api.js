/**
 * api.js — talks to the Cognitive Care backend.
 *
 * Uses environment-aware URL resolution (defaults to location.origin).
 */
const CareAPI = {
  getBackendUrl() {
    const custom = (localStorage.getItem('cbrain_backend_url') || '').replace(/\/+$/, '');
    if (custom) return custom;
    if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      return location.origin;
    }
    return 'http://127.0.0.1:8000';
  },

  async health() {
    const res = await fetch(`${this.getBackendUrl()}/api/health`, { method: 'GET' });
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },

  /**
   * message: string
   * context: { patient_id } or similar (object with patient_id)
   * conversation: [{role:'user'|'assistant', content:string}, ...] (no system message)
   */
  async sendMessage(message, context, conversation) {
    const lang = (typeof window.I18n !== 'undefined' && window.I18n.currentLang) ? window.I18n.currentLang() : 'en';
    const res = await fetch(`${this.getBackendUrl()}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        patient_id: context?.patient_id ?? null,
        conversation: conversation ?? [],
        language: lang,
      }),
    });

    if (!res.ok) {
      throw new Error(`Assistant request failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.success) {
      const err = new Error(data.answer || 'Assistant backend returned an error.');
      err.code = data.error || 'unknown';
      throw err;
    }
    return data.answer;
  },
};
