import { Platform } from 'react-native';

/**
 * Everything web browsers do that native never would: zoom the whole page in
 * when a focused input's font-size is under 16px (most of ours, by design);
 * paint their own focus ring on `<input>`/`<textarea>` — react-native-web
 * maps RN's `border*` style props to CSS `border`, but that outline is a
 * separate property no RN style prop reaches; let text be selected, long-
 * pressed into a copy/share menu, or dragged as a browser drag-image; flash
 * a grey highlight on every tap; and show a scrollbar. Runs once, client-side
 * only; this app's web build is a plain client bundle, so there's no
 * server-side document to set these on ahead of time.
 */
export function applyWebInputFixes() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
  );

  if (document.body && !document.getElementById('status-bar-fill')) {
    const fill = document.createElement('div');
    fill.id = 'status-bar-fill';
    fill.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(fill, document.body.firstChild);
  }

  let style = document.getElementById('web-input-fixes') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'web-input-fixes';
    document.head.appendChild(style);
  }
  style.textContent = `
    html, body {
      margin: 0;
      height: 100%;
      background-color: #FAF8F6;
      overscroll-behavior: none;
    }

    body {
      overflow: visible;
    }

    #root {
      display: flex;
      flex: 1;
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      background-color: #FAF8F6;
      overscroll-behavior: none;
    }

    #status-bar-fill {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 6px;
      background-color: #FAF8F6;
      pointer-events: none;
      z-index: 9999;
    }

    * {
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-drag: none;
      cursor: default;
    }

    body, [role="button"], [role="link"] {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }

    *::-webkit-scrollbar {
      display: none;
    }
    * {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    input, textarea, select, [contenteditable] {
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
      cursor: text;
      outline: none;
      box-shadow: none;
      -webkit-tap-highlight-color: transparent;
    }
    input:focus, textarea:focus, select:focus, [contenteditable]:focus {
      outline: none;
      box-shadow: none;
    }
  `;
}
