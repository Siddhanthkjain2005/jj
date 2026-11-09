// Android/WebView back navigation. Returning false delegates root-exit policy to the native shell.
// This module never exits the app, changes the vehicle, or inserts fake entries in browser history.
const ROOTS = new Set(['title', 'hub']);
const SAFE_HISTORY = new Set(['hub', 'garage', 'event', 'onboard', 'academy', 'customize', 'lab', 'explorer', 'team', 'records']);
const SESSION_BOUNDARIES = new Set(['none', 'pause', 'lesson', 'results']);

function visible(element) {
  return !!element && !element.hidden && !element.disabled && element.getClientRects().length > 0;
}
function editable(element) {
  if (!element) return false;
  if (element.isContentEditable || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') return true;
  return element.tagName === 'INPUT' && !['button','submit','reset','checkbox','radio','range','color','file','hidden'].includes(element.type);
}

export class AppNavigation {
  constructor(game) { this.game = game; this.history = []; this.returning = false; this.wired = false; }

  wire() {
    if (this.wired) return;
    this.wired = true;
    // A native shell can evaluate Boolean(window.__vv?.androidBack?.()). A false
    // result means the hub/title is already visible; only the shell decides whether to exit.
    this.game.androidBack = () => this.back();
  }

  onScreen(id, previous) {
    if (ROOTS.has(id) || SESSION_BOUNDARIES.has(id) || this.game.mode !== 'menu') {
      this.history.length = 0;
      return;
    }
    if (this.returning || !previous || id === previous) return;
    // Explicit Back buttons may return to an older menu without using .back().
    // Remove that menu and everything after it so subsequent Back does not loop.
    const existing = this.history.lastIndexOf(id);
    if (existing >= 0) { this.history.length = existing; return; }
    if (SAFE_HISTORY.has(previous) && this.history[this.history.length - 1] !== previous) {
      this.history.push(previous);
      this.history = this.history.slice(-24);
    }
  }

  backButton() {
    return [...document.querySelectorAll('.screen.active [data-back]')].find(visible);
  }

  back() {
    const g = this.game, dialog = document.getElementById('dialog');
    if (visible(dialog)) {
      const cancel = document.getElementById('dialog-cancel');
      if (visible(cancel)) cancel.click(); else dialog.hidden = true;
      return true;
    }
    if (g.input?.remapCallback) {
      const cancel = g.input.remapCallback; g.input.remapCallback = null; cancel(null);
      return true;
    }
    // Let the first Back dismiss a text field's software keyboard or selection.
    // A subsequent Back navigates; gamepad and the existing Escape path are unaffected.
    if (editable(document.activeElement) && visible(document.activeElement)) { document.activeElement.blur(); return true; }
    if (g.mode === 'race') {
      if (!g.paused) { g.pause(); return true; }
      if (g.screen === 'pause') { g.resume(); return true; }
      const button = this.backButton();
      if (button) button.click(); else g.show('pause');
      return true;
    }
    if (ROOTS.has(g.screen)) return false;
    const button = this.backButton();
    if (button) { button.click(); return true; }
    while (this.history.length) {
      const previous = this.history.pop();
      if (!SAFE_HISTORY.has(previous) || previous === g.screen || !document.getElementById('scr-' + previous)) continue;
      this.returning = true;
      try { g.show(previous); } finally { this.returning = false; }
      return true;
    }
    g.show('hub');
    return true;
  }
}
