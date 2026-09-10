/**
 * call.js — WebRTC voice & video call engine and Calls UI controller for Cognitive Care Platform.
 *
 * Capabilities:
 *  - Environment-aware URL resolution (production HTTPS/WSS vs local HTTP/WS).
 *  - Background signaling listener (`initSignalingListener`) auto-connected on login.
 *  - Bi-directional calling: Patient <-> Doctor, Patient <-> Caregiver.
 *  - Single Call button trigger -> pre-call mode selection modal (Voice vs Video).
 *  - Incoming Call Modal UI with Accept and Decline buttons.
 *  - Full-screen responsive video call interface (primary remote video + floating picture-in-picture local camera).
 *  - Voice call stage with animated avatar pulse and call duration timer.
 *  - Floating controls: Mute Mic, Toggle Camera, Speaker Mute, Fullscreen, End Call.
 *  - Media track & PeerConnection cleanup on hangup/reject/error.
 *  - Backend `/api/calls` integration (CallLog creation, accept, reject, cancel, end with duration).
 *  - CallsUI controller for rendering scoped contacts, call history, and category filters.
 *  - Conflict prevention: pauses VoiceIO / assistant speech recognition during active calls.
 */

const CallManager = (() => {
  // -------------------------------------------------------------------------
  // Config & State
  // -------------------------------------------------------------------------
  const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  let _state = 'idle';          // idle | calling | ringing | connected | ended | failed
  let _ws = null;               // Active signaling WebSocket
  let _listenerWs = null;       // Background listener WebSocket
  let _pc = null;               // RTCPeerConnection
  let _localStream = null;      // getUserMedia MediaStream
  let _isVideo = false;         // true = video call, false = voice call
  let _patientId = null;        // patient_id scoping room
  let _isInitiator = false;     // true if we initiated the call
  let _pendingCandidates = [];  // ICE candidate queue
  let _callTimerInterval = null;// Call duration timer interval
  let _callStartTime = 0;       // Timestamp when call connected
  let _remoteSpeakerMuted = false;
  let _peerInfo = { name: 'Peer', role: '', id: '' };
  let _activeCallId = null;     // Backend CallLog ID

  // -------------------------------------------------------------------------
  // Helpers & Environment-aware URLs
  // -------------------------------------------------------------------------
  function _getBackendUrl() {
    const custom = (localStorage.getItem('cbrain_backend_url') || '').replace(/\/+$/, '');
    if (custom) return custom;
    if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      return location.origin;
    }
    return 'http://127.0.0.1:8000';
  }

  function _getToken() {
    return localStorage.getItem('cbrain_auth_token')
        || localStorage.getItem('access_token')
        || sessionStorage.getItem('cbrain_auth_token')
        || '';
  }

  function _getWsUrl(patientId) {
    const base = _getBackendUrl();
    const token = _getToken();
    const wsProtocol = base.startsWith('https') ? 'wss:' : 'ws:';
    const hostPath = base.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${hostPath}/api/ws/call/${patientId}?token=${encodeURIComponent(token)}`;
  }

  function _setState(newState) {
    _state = newState;
    _updateModalUI();
  }

  function _notify(msg, level) {
    if (window.App && typeof window.App.showNotification === 'function') {
      window.App.showNotification(msg, level || 'info');
    } else {
      console.log(`[CallManager:${level || 'info'}]`, msg);
    }
  }

  function _el(id) { return document.getElementById(id); }

  // -------------------------------------------------------------------------
  // VoiceIO Conflict Prevention
  // -------------------------------------------------------------------------
  function _pauseVoiceIO() {
    if (window.VoiceIO && typeof window.VoiceIO.stopListening === 'function') {
      try {
        window.VoiceIO.stopListening();
        window.VoiceIO.stopSpeaking();
      } catch (e) {}
    }
  }

  // -------------------------------------------------------------------------
  // UI & Full-screen Video Controller
  // -------------------------------------------------------------------------
  function _showModal() {
    const m = _el('call-modal');
    if (m) {
      m.classList.remove('hidden');
      m.setAttribute('aria-hidden', 'false');
    }
  }

  function _hideModal() {
    const m = _el('call-modal');
    if (m) {
      m.classList.add('hidden');
      m.setAttribute('aria-hidden', 'true');
    }
  }

  function _startTimer() {
    _stopTimer();
    _callStartTime = Date.now();
    const timerEl = _el('call-timer-text');
    if (timerEl) timerEl.style.display = 'inline-block';

    _callTimerInterval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - _callStartTime) / 1000);
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function _stopTimer() {
    if (_callTimerInterval) {
      clearInterval(_callTimerInterval);
      _callTimerInterval = null;
    }
    const timerEl = _el('call-timer-text');
    if (timerEl) {
      timerEl.textContent = '00:00';
      timerEl.style.display = 'none';
    }
  }

  function _updateModalUI() {
    const statusEl = _el('call-status-text');
    const titleEl = _el('call-modal-title');
    const acceptBtn = _el('call-accept-btn');
    const rejectBtn = _el('call-reject-btn');
    const endBtn = _el('call-end-btn');
    const muteBtn = _el('call-mute-btn');
    const videoBtn = _el('call-video-btn');
    const speakerBtn = _el('call-speaker-btn');
    const fsBtn = _el('call-fullscreen-btn');
    const localVideo = _el('call-local-video');
    const remoteVideo = _el('call-remote-video');
    const audioStage = _el('call-audio-stage');
    const modePanel = _el('call-mode-select-panel');
    const activePanel = _el('call-active-panel');
    const peerNameEl = _el('call-peer-display-name');
    const avatarInitialsEl = _el('call-avatar-initials');

    if (_state !== 'idle') {
      if (modePanel) modePanel.style.display = 'none';
      if (activePanel) activePanel.style.display = 'flex';
    }

    if (!statusEl) return;

    const modeTag = _isVideo ? '📹 Video' : '🎙️ Voice';
    const labels = {
      idle:      'Call ended.',
      calling:   `📞 Calling… waiting for answer (${modeTag})`,
      ringing:   `📲 Incoming ${modeTag} Call`,
      connected: `🟢 Connected (${modeTag})`,
      ended:     'Call ended.',
      failed:    '⚠️ Connection failed',
    };
    statusEl.textContent = labels[_state] || _state;
    if (titleEl) titleEl.textContent = _isVideo ? 'Video Call' : 'Voice Call';

    if (peerNameEl) {
      peerNameEl.textContent = _peerInfo.name || 'Participant';
    }
    if (avatarInitialsEl) {
      const parts = (_peerInfo.name || 'P').split(' ').filter(Boolean);
      avatarInitialsEl.textContent = ((parts[0]?.[0] || 'P') + (parts[1]?.[0] || '')).toUpperCase();
    }

    // Button display mapping
    if (acceptBtn) acceptBtn.style.display  = _state === 'ringing'   ? 'inline-flex' : 'none';
    if (rejectBtn) rejectBtn.style.display  = _state === 'ringing'   ? 'inline-flex' : 'none';
    if (endBtn)    endBtn.style.display     = (_state === 'calling' || _state === 'connected') ? 'inline-flex' : 'none';
    if (muteBtn)   muteBtn.style.display    = _state === 'connected' ? 'inline-flex' : 'none';
    if (videoBtn)  videoBtn.style.display   = (_state === 'connected' && _isVideo) ? 'inline-flex' : 'none';
    if (speakerBtn) speakerBtn.style.display = _state === 'connected' ? 'inline-flex' : 'none';
    if (fsBtn)     fsBtn.style.display      = (_state === 'connected' && _isVideo) ? 'inline-flex' : 'none';

    // Video vs Audio Stage visibility
    if (_isVideo && _state === 'connected') {
      if (remoteVideo) remoteVideo.style.display = 'block';
      if (localVideo)  localVideo.style.display  = 'block';
      if (audioStage)  audioStage.style.display  = 'none';
    } else {
      if (remoteVideo) remoteVideo.style.display = 'none';
      if (localVideo)  localVideo.style.display  = 'none';
      if (audioStage)  audioStage.style.display  = 'flex';
    }

    if (_state === 'connected') {
      _startTimer();
    } else if (_state === 'ended' || _state === 'failed' || _state === 'idle') {
      _stopTimer();
    }
  }

  // -------------------------------------------------------------------------
  // WebSocket Signaling
  // -------------------------------------------------------------------------
  function _openWs(patientId) {
    return new Promise((resolve, reject) => {
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        resolve(_ws);
        return;
      }
      const url = _getWsUrl(patientId);
      const ws = new WebSocket(url);

      ws.onopen = () => {
        _ws = ws;
        resolve(ws);
      };

      ws.onerror = () => {
        reject(new Error('Signaling server connection failed.'));
      };

      ws.onclose = () => {
        _ws = null;
        if (_state === 'connected' || _state === 'calling' || _state === 'ringing') {
          _handleDisconnect();
        }
      };

      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        _handleSignalingMessage(msg);
      };
    });
  }

  function _sendSignal(data) {
    const targetWs = _ws || _listenerWs;
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(JSON.stringify(data));
    }
  }

  function _closeWs() {
    if (_ws) {
      try { _ws.close(); } catch {}
      _ws = null;
    }
  }

  // -------------------------------------------------------------------------
  // WebRTC Peer Connection
  // -------------------------------------------------------------------------
  function _createPeerConnection() {
    const iceServers = window.ICE_SERVERS || DEFAULT_ICE_SERVERS;
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        _sendSignal({ type: 'ice-candidate', candidate: ev.candidate });
      }
    };

    pc.ontrack = (ev) => {
      const remoteVideo = _el('call-remote-video');
      if (remoteVideo && ev.streams && ev.streams[0]) {
        remoteVideo.srcObject = ev.streams[0];
        remoteVideo.muted = _remoteSpeakerMuted;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        _setState('connected');
        if (_activeCallId && typeof AuthLayer !== 'undefined') {
          AuthLayer.authFetch(`/api/calls/${_activeCallId}/accept`, { method: 'POST' }).catch(() => {});
        }
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        if (_state === 'connected') {
          _handleDisconnect();
        }
      }
    };

    return pc;
  }

  function _addLocalTracks(pc, stream) {
    if (!pc || !stream) return;
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
  }

  function _closePeerConnection() {
    if (_pc) {
      try { _pc.close(); } catch {}
      _pc = null;
    }
    _pendingCandidates = [];
  }

  function _stopLocalStream() {
    if (_localStream) {
      _localStream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      _localStream = null;
    }
    const localVideo = _el('call-local-video');
    if (localVideo) localVideo.srcObject = null;
    const remoteVideo = _el('call-remote-video');
    if (remoteVideo) remoteVideo.srcObject = null;
  }

  // -------------------------------------------------------------------------
  // Signaling Message Handler
  // -------------------------------------------------------------------------
  async function _handleSignalingMessage(msg) {
    const type = msg.type;

    if (type === 'room-status') {
      if (_isInitiator && msg.peers && msg.peers.length > 0) {
        _peerInfo = {
          name: msg.peers[0].peer_name || 'Participant',
          role: msg.peers[0].peer_role || '',
          id: msg.peers[0].peer_id || '',
        };
        _sendSignal({ type: 'call-request', is_video: _isVideo });
      }
      return;
    }

    if (type === 'peer-joined') {
      if (msg.peer_name) {
        _peerInfo = { name: msg.peer_name, role: msg.peer_role || '', id: msg.peer_id || '' };
      }
      if (_isInitiator && _state === 'calling') {
        _sendSignal({ type: 'call-request', is_video: _isVideo });
      }
      return;
    }

    if (type === 'peer-left') {
      if (_state === 'connected' || _state === 'calling' || _state === 'ringing') {
        _notify('The other participant left the call.', 'info');
        _endCallCleanup();
      }
      return;
    }

    if (type === 'call-request') {
      if (_state !== 'idle') {
        _sendSignal({ type: 'reject', reason: 'busy' });
        return;
      }
      _pauseVoiceIO();
      _isInitiator = false;
      _isVideo = !!msg.is_video;
      _peerInfo = {
        name: msg.sender_name || 'Caller',
        role: msg.sender_role || '',
        id: msg.sender_id || '',
      };
      _setState('ringing');
      _showModal();
      return;
    }

    if (type === 'call-accepted') {
      if (_state === 'calling' && _isInitiator) {
        await _sendOffer();
      }
      return;
    }

    if (type === 'reject') {
      const reason = msg.reason === 'busy' ? 'Participant is busy.' : 'Call was declined.';
      _notify(reason, 'warning');
      if (_activeCallId && typeof AuthLayer !== 'undefined') {
        AuthLayer.authFetch(`/api/calls/${_activeCallId}/reject`, { method: 'POST' }).catch(() => {});
      }
      _endCallCleanup();
      return;
    }

    if (type === 'hangup') {
      _notify('Call ended by remote party.', 'info');
      _endCallCleanup();
      return;
    }

    if (type === 'offer') {
      _pauseVoiceIO();
      if (!_pc) {
        try {
          _localStream = await _getMedia(_isVideo);
        } catch (err) {
          _notify('Cannot access camera/microphone: ' + err.message, 'error');
          _sendSignal({ type: 'reject', reason: 'media_error' });
          _endCallCleanup();
          return;
        }
        _pc = _createPeerConnection();
        _addLocalTracks(_pc, _localStream);
        const localVideo = _el('call-local-video');
        if (localVideo && _isVideo) localVideo.srcObject = _localStream;
      }
      try {
        await _pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const c of _pendingCandidates) {
          try { await _pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        _pendingCandidates = [];

        const answer = await _pc.createAnswer();
        await _pc.setLocalDescription(answer);
        _sendSignal({ type: 'answer', sdp: _pc.localDescription });
      } catch (err) {
        _notify('Call connection error: ' + err.message, 'error');
        _endCallCleanup();
      }
      return;
    }

    if (type === 'answer') {
      if (_pc && _pc.signalingState === 'have-local-offer') {
        try {
          await _pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          for (const c of _pendingCandidates) {
            try { await _pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          _pendingCandidates = [];
        } catch (err) {
          _notify('Failed to establish peer connection: ' + err.message, 'error');
        }
      }
      return;
    }

    if (type === 'ice-candidate') {
      if (_pc && _pc.remoteDescription) {
        try { await _pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      } else {
        _pendingCandidates.push(msg.candidate);
      }
      return;
    }

    if (type === 'mic-toggle') {
      const mutedEl = _el('call-remote-muted');
      if (mutedEl) mutedEl.textContent = msg.muted ? '🔇 Remote mic muted' : '';
      return;
    }
  }

  function _handleDisconnect() {
    _notify('Call connection dropped.', 'warning');
    _endCallCleanup();
  }

  async function _getMedia(isVideo) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone/camera access was denied. Allow permissions and try again.');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('No camera or microphone found on this device.');
      }
      throw err;
    }
  }

  function _endCallCleanup() {
    const previousState = _state;
    const duration = _callStartTime ? Math.max(0, Math.floor((Date.now() - _callStartTime) / 1000)) : 0;

    _closePeerConnection();
    _stopLocalStream();
    _closeWs();
    _setState('ended');

    if (_activeCallId && typeof AuthLayer !== 'undefined') {
      if (previousState === 'connected') {
        AuthLayer.authFetch(`/api/calls/${_activeCallId}/end`, {
          method: 'POST',
          body: JSON.stringify({ duration_seconds: duration }),
        }).catch(() => {});
      } else if (previousState === 'calling' || previousState === 'ringing') {
        AuthLayer.authFetch(`/api/calls/${_activeCallId}/cancel`, { method: 'POST' }).catch(() => {});
      }
    }
    _activeCallId = null;

    setTimeout(() => {
      _setState('idle');
      _hideModal();
    }, 1200);

    _isInitiator = false;
    _patientId = null;
    _isVideo = false;
    _remoteSpeakerMuted = false;

    if (typeof window.CallsUI !== 'undefined' && typeof window.CallsUI.render === 'function') {
      setTimeout(() => window.CallsUI.render(), 1500);
    }
  }

  async function _sendOffer() {
    if (!_pc || !_localStream) return;
    try {
      const offer = await _pc.createOffer();
      await _pc.setLocalDescription(offer);
      _sendSignal({ type: 'offer', sdp: _pc.localDescription });
    } catch (err) {
      _notify('Failed to create offer: ' + err.message, 'error');
      _endCallCleanup();
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  return {
    getState() { return _state; },

    async initSignalingListener(patientId) {
      if (!patientId || _listenerWs) return;
      try {
        const url = _getWsUrl(patientId);
        const ws = new WebSocket(url);
        ws.onopen = () => { _listenerWs = ws; };
        ws.onmessage = (ev) => {
          let msg;
          try { msg = JSON.parse(ev.data); } catch { return; }
          _handleSignalingMessage(msg);
        };
        ws.onclose = () => {
          _listenerWs = null;
          setTimeout(() => this.initSignalingListener(patientId), 5000);
        };
      } catch (e) {}
    },

    async startCall(patientId, isVideo) {
      if (_state !== 'idle') {
        _notify('Already in an active call.', 'warning');
        return;
      }
      if (!navigator.mediaDevices || !window.RTCPeerConnection) {
        _notify('Your browser does not support WebRTC calling.', 'error');
        return;
      }

      _pauseVoiceIO();
      _patientId = patientId;
      _isVideo = !!isVideo;
      _isInitiator = true;

      _showModal();
      _setState('calling');

      // Initiate CallLog in backend
      try {
        if (typeof AuthLayer !== 'undefined' && AuthLayer.isLoggedIn()) {
          const res = await AuthLayer.authFetch('/api/calls/initiate', {
            method: 'POST',
            body: JSON.stringify({
              patient_id: patientId,
              call_type: _isVideo ? 'video' : 'voice',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            _activeCallId = data.id;
          }
        }
      } catch (e) {
        console.warn('Failed to record call initiation:', e);
      }

      try {
        _localStream = await _getMedia(_isVideo);
      } catch (err) {
        _notify(err.message, 'error');
        _setState('failed');
        setTimeout(() => { _setState('idle'); _hideModal(); }, 2000);
        return;
      }

      const localVideo = _el('call-local-video');
      if (localVideo && _isVideo) {
        localVideo.srcObject = _localStream;
        localVideo.style.display = 'block';
      }

      try {
        await _openWs(patientId);
      } catch (err) {
        _notify(err.message, 'error');
        _stopLocalStream();
        _setState('failed');
        setTimeout(() => { _setState('idle'); _hideModal(); }, 2000);
        return;
      }

      _pc = _createPeerConnection();
      _addLocalTracks(_pc, _localStream);
    },

    async acceptCall() {
      if (_state !== 'ringing') return;
      _setState('calling');

      if (_activeCallId && typeof AuthLayer !== 'undefined') {
        AuthLayer.authFetch(`/api/calls/${_activeCallId}/accept`, { method: 'POST' }).catch(() => {});
      }

      try {
        _localStream = await _getMedia(_isVideo);
      } catch (err) {
        _notify(err.message, 'error');
        _sendSignal({ type: 'reject', reason: 'media_error' });
        _endCallCleanup();
        return;
      }

      const localVideo = _el('call-local-video');
      if (localVideo && _isVideo) {
        localVideo.srcObject = _localStream;
        localVideo.style.display = 'block';
      }

      _sendSignal({ type: 'call-accepted' });
    },

    rejectCall() {
      if (_state !== 'ringing') return;
      if (_activeCallId && typeof AuthLayer !== 'undefined') {
        AuthLayer.authFetch(`/api/calls/${_activeCallId}/reject`, { method: 'POST' }).catch(() => {});
      }
      _sendSignal({ type: 'reject', reason: 'declined' });
      _endCallCleanup();
    },

    hangup() {
      if (_state === 'idle') return;
      _sendSignal({ type: 'hangup' });
      _endCallCleanup();
    },

    toggleMute() {
      if (!_localStream) return;
      const audioTracks = _localStream.getAudioTracks();
      const nowMuted = audioTracks.some(t => !t.enabled);
      audioTracks.forEach(t => { t.enabled = nowMuted; });
      const muteBtn = _el('call-mute-btn');
      if (muteBtn) muteBtn.textContent = nowMuted ? '🎙️ Unmute' : '🔇 Mute';
      _sendSignal({ type: 'mic-toggle', muted: !nowMuted });
    },

    toggleVideo() {
      if (!_localStream) return;
      const videoTracks = _localStream.getVideoTracks();
      const nowOff = videoTracks.some(t => !t.enabled);
      videoTracks.forEach(t => { t.enabled = nowOff; });
      const videoBtn = _el('call-video-btn');
      if (videoBtn) videoBtn.textContent = nowOff ? '📹 Camera On' : '📷 Camera Off';
      const localVideo = _el('call-local-video');
      if (localVideo) localVideo.style.display = nowOff ? 'block' : 'none';
    },

    toggleSpeaker() {
      const remoteVideo = _el('call-remote-video');
      _remoteSpeakerMuted = !_remoteSpeakerMuted;
      if (remoteVideo) remoteVideo.muted = _remoteSpeakerMuted;
      const speakerBtn = _el('call-speaker-btn');
      if (speakerBtn) speakerBtn.textContent = _remoteSpeakerMuted ? '🔈 Unmute Speaker' : '🔊 Speaker';
    },

    toggleFullscreen() {
      const modal = _el('call-modal');
      if (!modal) return;
      if (!document.fullscreenElement) {
        if (modal.requestFullscreen) modal.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      }
    },
  };
})();

// Expose globally
window.CallManager = CallManager;

// =============================================================================
// CallsUI Controller — Scoped Contacts & Call History
// =============================================================================
const CallsUI = {
  _activeFilter: 'all',
  _searchQuery: '',
  _historyData: [],
  _contactsData: [],

  setFilter(filterName, btnEl) {
    this._activeFilter = filterName;
    const parent = btnEl ? btnEl.parentElement : document.querySelector('.calls-filter-pills');
    if (parent) {
      parent.querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
      if (btnEl) btnEl.classList.add('is-active');
    }
    this.renderHistory();
  },

  onSearchInput(val) {
    this._searchQuery = (val || '').trim().toLowerCase();
    this.renderHistory();
    this.renderContacts();
  },

  async render() {
    await Promise.all([
      this.loadContacts(),
      this.loadHistory(),
    ]);
  },

  async loadContacts() {
    const grid = document.getElementById('calls-contacts-grid');
    if (!grid) return;

    try {
      if (typeof AuthLayer !== 'undefined' && AuthLayer.isLoggedIn()) {
        const user = AuthLayer.getUser();
        if (user.role === 'doctor' || user.role === 'caregiver') {
          if (typeof DataLayer !== 'undefined' && DataLayer.syncFromServer) {
            await DataLayer.syncFromServer();
          }
          const patients = DataLayer.listPatients ? DataLayer.listPatients() : [];
          this._contactsData = patients.map(p => ({
            id: p.id,
            patientId: p.id,
            name: p.name || 'Patient',
            role: 'patient',
            roleLabel: 'Patient',
            avatar: (p.name || 'P').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(),
          }));
        } else if (user.role === 'patient') {
          const res = await AuthLayer.authFetch('/api/patients/me');
          if (res.ok) {
            const data = await res.json();
            const contacts = [];
            if (data.doctor_name) {
              contacts.push({
                id: data.doctor_id || user.patient_id,
                patientId: user.patient_id,
                name: 'Dr. ' + data.doctor_name,
                role: 'doctor',
                roleLabel: 'Attending Doctor',
                avatar: '👨‍⚕️',
              });
            }
            if (data.caregivers && data.caregivers.length > 0) {
              data.caregivers.forEach(cg => {
                contacts.push({
                  id: cg.id || user.patient_id,
                  patientId: user.patient_id,
                  name: cg.name || 'Caregiver',
                  role: 'caregiver',
                  roleLabel: 'Assigned Caregiver',
                  avatar: '🧑‍⚕️',
                });
              });
            }
            if (contacts.length === 0) {
              contacts.push({
                id: user.patient_id,
                patientId: user.patient_id,
                name: 'Care Provider',
                role: 'caregiver',
                roleLabel: 'Care Team',
                avatar: '🏥',
              });
            }
            this._contactsData = contacts;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load contacts:', e);
    }
    this.renderContacts();
  },

  renderContacts() {
    const grid = document.getElementById('calls-contacts-grid');
    if (!grid) return;

    let items = this._contactsData || [];
    if (this._searchQuery) {
      const q = this._searchQuery;
      items = items.filter(c => c.name.toLowerCase().includes(q) || c.roleLabel.toLowerCase().includes(q));
    }

    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 24px; text-align: center; color: var(--color-text-secondary);">No contacts found.</div>`;
      return;
    }

    grid.innerHTML = items.map(c => {
      return `
        <div class="patient-card" style="display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 20px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div class="patient-card__avatar" style="width:48px; height:48px; font-size:1.2rem; flex-shrink:0;">${c.avatar}</div>
            <div>
              <h3 style="font-size:1rem; font-weight:700; margin:0 0 2px 0; color:var(--color-text-primary);">${c.name}</h3>
              <p style="font-size:0.8rem; color:var(--color-text-secondary); margin:0;">${c.roleLabel}</p>
            </div>
          </div>
          <button class="btn btn--primary btn--sm" onclick="AppCallUI.openCallModalToPatient('${c.patientId}')" style="display:inline-flex; align-items:center; gap:6px; padding:8px 16px;">
            📞 Call
          </button>
        </div>
      `;
    }).join('');
  },

  async loadHistory() {
    try {
      if (typeof AuthLayer !== 'undefined' && AuthLayer.isLoggedIn()) {
        const res = await AuthLayer.authFetch('/api/calls');
        if (res.ok) {
          this._historyData = await res.json();
        }
      }
    } catch (e) {
      console.warn('Failed to load call history:', e);
    }
    this.renderHistory();
  },

  renderHistory() {
    const listEl = document.getElementById('calls-history-list');
    const emptyEl = document.getElementById('calls-empty-state');
    if (!listEl) return;

    let items = this._historyData || [];
    const currentUserId = (typeof AuthLayer !== 'undefined' && AuthLayer.getUser()) ? AuthLayer.getUser().id : '';

    if (this._activeFilter !== 'all') {
      const f = this._activeFilter;
      if (f === 'missed') {
        items = items.filter(x => x.status === 'missed' || x.status === 'rejected');
      } else if (f === 'incoming') {
        items = items.filter(x => x.receiver_id === currentUserId);
      } else if (f === 'outgoing') {
        items = items.filter(x => x.caller_id === currentUserId);
      } else if (f === 'video') {
        items = items.filter(x => x.call_type === 'video');
      } else if (f === 'voice') {
        items = items.filter(x => x.call_type === 'voice');
      }
    }

    if (this._searchQuery) {
      const q = this._searchQuery;
      items = items.filter(x =>
        (x.caller_name || '').toLowerCase().includes(q) ||
        (x.receiver_name || '').toLowerCase().includes(q) ||
        (x.status || '').toLowerCase().includes(q)
      );
    }

    if (items.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = items.map(item => {
      const isOutgoing = item.caller_id === currentUserId;
      const peerName = isOutgoing ? (item.receiver_name || 'Participant') : (item.caller_name || 'Caller');
      const isVideo = item.call_type === 'video';
      const typeIcon = isVideo ? '📹' : '🎙️';

      let statusBadgeClass = 'badge--secondary';
      let statusIcon = '📞';
      let statusText = item.status;

      if (item.status === 'completed') {
        statusBadgeClass = 'badge--success';
        statusIcon = isOutgoing ? '↗️' : '↙️';
        statusText = 'Completed';
      } else if (item.status === 'missed' || item.status === 'rejected') {
        statusBadgeClass = 'badge--danger';
        statusIcon = '❌';
        statusText = item.status === 'missed' ? 'Missed Call' : 'Declined';
      } else if (item.status === 'initiated' || item.status === 'connected') {
        statusBadgeClass = 'badge--info';
        statusIcon = '🟢';
        statusText = 'Active';
      }

      const durMin = Math.floor((item.duration_seconds || 0) / 60);
      const durSec = (item.duration_seconds || 0) % 60;
      const durationStr = (item.duration_seconds && item.duration_seconds > 0)
        ? `${durMin}m ${durSec}s`
        : '';

      const dt = item.created_at ? new Date(item.created_at) : new Date();
      const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return `
        <div class="card" style="margin-bottom:12px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:42px; height:42px; border-radius:50%; background:var(--color-bg-secondary); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
              ${typeIcon}
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; font-size:0.95rem; color:var(--color-text-primary);">${peerName}</span>
                <span class="badge ${statusBadgeClass}" style="font-size:0.75rem; padding:2px 8px;">${statusIcon} ${statusText}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px;">
                ${dateStr} at ${timeStr} ${durationStr ? ' &middot; ' + durationStr : ''}
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn--sm btn--outline" onclick="CallsUI.callBack('${item.patient_id}', ${isVideo})" style="display:inline-flex; align-items:center; gap:6px;">
              📞 Call Back
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  callBack(patientId, isVideo) {
    if (!patientId) {
      if (typeof App !== 'undefined') App.showNotification('Cannot initiate call back: unknown patient ID', 'warning');
      return;
    }
    AppCallUI.openCallModalToPatient(patientId);
  }
};

window.CallsUI = CallsUI;

// Bind UI listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const acceptBtn  = document.getElementById('call-accept-btn');
  const rejectBtn  = document.getElementById('call-reject-btn');
  const endBtn     = document.getElementById('call-end-btn');
  const muteBtn    = document.getElementById('call-mute-btn');
  const videoBtn   = document.getElementById('call-video-btn');
  const speakerBtn = document.getElementById('call-speaker-btn');
  const fsBtn      = document.getElementById('call-fullscreen-btn');

  if (acceptBtn)  acceptBtn.addEventListener('click',  () => CallManager.acceptCall());
  if (rejectBtn)  rejectBtn.addEventListener('click',  () => CallManager.rejectCall());
  if (endBtn)     endBtn.addEventListener('click',     () => CallManager.hangup());
  if (muteBtn)    muteBtn.addEventListener('click',    () => CallManager.toggleMute());
  if (videoBtn)   videoBtn.addEventListener('click',   () => CallManager.toggleVideo());
  if (speakerBtn) speakerBtn.addEventListener('click', () => CallManager.toggleSpeaker());
  if (fsBtn)      fsBtn.addEventListener('click',      () => CallManager.toggleFullscreen());
});
