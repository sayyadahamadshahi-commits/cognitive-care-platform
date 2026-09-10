/**
 * voice.js — browser Speech Recognition (input) + Speech Synthesis (output).
 * No external API, no key required.
 *
 * Fixes applied vs. a naive implementation:
 *  1. Secure-context check. SpeechRecognition silently refuses to work on
 *     pages opened as file:// or served over plain http:// on a non-localhost
 *     host — this is the #1 cause of "the mic button does nothing". We
 *     detect it up front and show a clear message instead of failing silently.
 *  2. Re-entrancy guard. Tapping the mic twice quickly (or a stray double
 *     event) used to throw "InvalidStateError: recognition has already
 *     started". A `_starting` flag prevents overlapping start() calls.
 *  3. Feedback-loop prevention. If the mic stays "hot" while the assistant's
 *     TTS reply is playing through the speakers, it can transcribe its own
 *     voice as new input. We always stop recognition before speak() and only
 *     resume (in conversation mode) after the utterance has fully finished,
 *     with a short buffer to let device audio drain.
 *  4. True voice-to-voice mode. `startConversation()` loops
 *     listen -> respond -> speak -> listen automatically, so the user
 *     doesn't have to tap the mic after every turn.
 *  5. Recoverable errors (`no-speech`, `network`, `aborted`) auto-retry once
 *     instead of just dying; `not-allowed` (permission denied) surfaces a
 *     clear, actionable message instead of a generic one.
 */
const VoiceIO = {
  recognition: null,
  isListening: false,
  supported: false,
  conversationMode: false,

  _starting: false,
  _onResultCallback: null,
  _retriedOnce: false,

  init() {
    if (window.isSecureContext === false) {
      this.supported = false;
      this._insecureContext = true;
      return false;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.supported = false;
      return false;
    }

    this.supported = true;
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = localStorage.getItem('cbrain_voice_lang') || navigator.language || 'en-US';

    this.recognition.onresult = (event) => {
      this._retriedOnce = false;
      const transcript = event.results[event.results.length - 1][0].transcript;
      if (this._onResultCallback) this._onResultCallback(transcript);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      this._starting = false;
      this._setMicUI(false);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.conversationMode = false;
        this._notify('Microphone access was blocked. Allow microphone permissions for this site and try again.', 'error');
        return;
      }

      // Recoverable — retry once automatically before giving up, since
      // these fire fairly often on flaky connections / brief silence.
      if ((event.error === 'no-speech' || event.error === 'network' || event.error === 'aborted') && !this._retriedOnce) {
        this._retriedOnce = true;
        setTimeout(() => {
          if (this.conversationMode || this._wantRestart) this._start();
        }, 400);
        return;
      }

      this._retriedOnce = false;
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this._notify('Voice input error: ' + event.error, 'error');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this._starting = false;
      this._setMicUI(false);
    };

    return true;
  },

  /** Single-shot listen: caller supplies onResult(transcript). */
  startListening(onResult) {
    if (this._insecureContext) {
      this._notify('Voice input needs a secure connection (https:// or localhost) — it won\'t work when the file is opened directly from disk. Use the hosted version, or run a local server.', 'warning');
      return false;
    }
    if (!this.supported && !this.init()) {
      this._notify('Speech recognition is not supported in this browser. Try Chrome or Edge, or type your message instead.', 'warning');
      return false;
    }
    this._onResultCallback = onResult;
    return this._start();
  },

  _start() {
    if (this.isListening || this._starting) return false;
    this._starting = true;
    try {
      this.recognition.start();
      this.isListening = true;
      this._setMicUI(true);
      return true;
    } catch (e) {
      // Most commonly "already started" from a race — treat as non-fatal.
      this._starting = false;
      console.warn('VoiceIO.start() failed:', e.message);
      return false;
    }
  },

  stopListening() {
    this.conversationMode = false;
    this._wantRestart = false;
    if (this.recognition && this.isListening) this.recognition.stop();
    this.isListening = false;
  },

  /**
   * True voice-to-voice conversation: keeps listening -> onTurn -> (speak) ->
   * listening again until stopListening()/toggled off. `onTurn` must be an
   * async function that takes the transcript and itself decides whether/what
   * to speak back (it should call VoiceIO.speak so this loop knows when the
   * reply audio has finished before re-arming the mic).
   */
  startConversation(onTurn) {
    this.conversationMode = true;
    const loop = (transcript) => {
      if (!this.conversationMode) return;
      Promise.resolve(onTurn(transcript)).finally(() => {
        if (this.conversationMode) {
          // small buffer so trailing playback audio doesn't get picked up
          setTimeout(() => this.startListening(loop), 250);
        }
      });
    };
    this.startListening(loop);
  },

  speak(text, onEnd) {
    // Never let the mic listen to our own voice.
    const wasListening = this.isListening;
    if (wasListening) {
      this._wantRestart = false;
      if (this.recognition) this.recognition.stop();
    }

    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return false;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = this.recognition?.lang || navigator.language || 'en-US';
    utterance.rate = 0.98;
    utterance.pitch = 1.0;
    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utterance);
    return true;
  },

  stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  },

  _setMicUI(listening) {
    const mic = document.getElementById('assistant-mic-btn');
    if (mic) mic.classList.toggle('mic-btn--listening', listening);
  },

  _notify(msg, level) {
    if (window.App && typeof window.App.showNotification === 'function') {
      window.App.showNotification(msg, level);
    } else {
      console.warn(`[VoiceIO:${level}]`, msg);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => VoiceIO.init());
