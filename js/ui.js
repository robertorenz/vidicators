'use strict';
// ---------------------------------------------------------------------------
// Page chrome: modal dialogs (controls, settings, high scores, initials),
// fullscreen and canvas sizing.
// ---------------------------------------------------------------------------
const UI = {
  open: new Set(),

  openModal(id) {
    const m = document.getElementById('modal-' + id);
    if (!m) return;
    if (id === 'scores') this.fillScores();
    if (id === 'settings') this.fillSettings();
    m.hidden = false;
    this.open.add(id);
    G.modalOpen = true;
    Input.blocked = true; Input.clear();
    const f = m.querySelector('[autofocus], input, select, button.primary');
    if (f) setTimeout(() => f.focus(), 30);
  },

  closeModal(id) {
    const m = document.getElementById('modal-' + id);
    if (!m || m.hidden) return;
    m.hidden = true;
    this.open.delete(id);
    if (!this.open.size) { G.modalOpen = false; Input.blocked = false; Input.clear(); }
    if (m._resolve) { const r = m._resolve; m._resolve = null; r(m._value || null); }
    document.getElementById('screen').focus();
  },

  fillScores() {
    const tb = document.querySelector('#scoreTable tbody');
    tb.innerHTML = '';
    G.hiscores.forEach((h, i) => {
      const tr = document.createElement('tr');
      for (const v of [i + 1, h.name, h.score.toLocaleString(), h.station]) {
        const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      }
      tb.appendChild(tr);
    });
  },

  fillSettings() {
    const f = document.getElementById('settingsForm');
    f.controlMode.value = Settings.controlMode;
    f.difficulty.value = Settings.difficulty;
    f.sound.checked = Settings.sound;
    f.speech.checked = Settings.speech;
    f.radar.checked = Settings.radar;
    f.volume.value = Math.round(Settings.volume * 100);
  },

  readSettings() {
    const f = document.getElementById('settingsForm');
    Settings.controlMode = f.controlMode.value;
    Settings.difficulty = f.difficulty.value;
    Settings.sound = f.sound.checked;
    Settings.speech = f.speech.checked;
    Settings.radar = f.radar.checked;
    Settings.volume = Number(f.volume.value) / 100;
    Settings.save();
    Sound.applyVolume();
    this.syncModeLabel();
  },

  syncModeLabel() {
    const el = document.getElementById('modeBadge');
    if (el) el.textContent = Settings.controlMode === 'classic' ? 'Classic tread controls' : 'Simple controls';
  },

  askInitials(playerNum, score) {
    const m = document.getElementById('modal-initials');
    document.getElementById('initialsTitle').textContent = `Player ${playerNum} — new high score!`;
    document.getElementById('initialsScore').textContent = score.toLocaleString();
    const inp = document.getElementById('initialsInput');
    inp.value = '';
    m._value = null;
    return new Promise(res => { m._resolve = res; this.openModal('initials'); });
  },

  resize() {
    const stage = document.getElementById('stage');
    const cv = document.getElementById('screen');
    const fs = !!document.fullscreenElement;
    const pad = fs ? 0 : 20;                       // room for the bezel frame
    const availW = Math.max(200, stage.clientWidth - pad);
    const availH = Math.max(150, stage.clientHeight - pad);
    // The logical view stays 384 tall; its width follows the window shape
    // (4:3 arcade up to 2:1) so the playfield fills the screen.
    VIEW_W = Math.round(clamp(VIEW_H * availW / availH, BASE_W, 768) / 2) * 2;
    const k = Math.min(availW / VIEW_W, availH / VIEW_H);
    cv.style.width = Math.floor(VIEW_W * k) + 'px';
    cv.style.height = Math.floor(VIEW_H * k) + 'px';
    // Render at the display's real pixel density (capped to keep memory sane).
    RS = Math.max(1, Math.min(4, k * (window.devicePixelRatio || 1)));
    cv.width = Math.round(VIEW_W * RS);
    cv.height = Math.round(VIEW_H * RS);
    if (typeof G !== 'undefined' && G.level) updateCamera(0, true);
  },

  init() {
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => this.openModal(b.dataset.open)));
    document.querySelectorAll('.modal').forEach(m => {
      const id = m.id.replace('modal-', '');
      m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeModal(id)));
      m.addEventListener('mousedown', e => { if (e.target === m && id !== 'initials') this.closeModal(id); });
      m.addEventListener('keydown', e => { if (e.key === 'Escape' && id !== 'initials') { e.preventDefault(); this.closeModal(id); } });
    });

    const form = document.getElementById('settingsForm');
    form.addEventListener('input', () => this.readSettings());
    form.addEventListener('change', () => this.readSettings());
    form.addEventListener('submit', e => { e.preventDefault(); this.closeModal('settings'); });

    document.getElementById('resetScores').addEventListener('click', () => this.openModal('confirmReset'));
    document.getElementById('confirmResetYes').addEventListener('click', () => {
      G.hiscores = DEFAULT_SCORES.map(o => ({ ...o }));
      saveHiscores(G.hiscores);
      this.fillScores();
      this.closeModal('confirmReset');
    });

    const inp = document.getElementById('initialsInput');
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });
    document.getElementById('initialsForm').addEventListener('submit', e => {
      e.preventDefault();
      const m = document.getElementById('modal-initials');
      m._value = inp.value || 'AAA';
      this.closeModal('initials');
    });

    document.getElementById('btnFull').addEventListener('click', () => {
      const stage = document.getElementById('stage');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => this.resize());
    window.addEventListener('resize', () => this.resize());

    this.syncModeLabel();
    this.resize();
  },
};

window.addEventListener('DOMContentLoaded', () => {
  Game.boot();
  UI.init();
  UI.syncModeLabel();
  if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').catch(() => {});
});
