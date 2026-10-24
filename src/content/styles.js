export const OVERLAY_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer, .fx { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.ctp-mirror { position: fixed; visibility: hidden; pointer-events: none; overflow: hidden; margin: 0; }

/* Highlight under the offending text */
.ctp-hl {
  position: fixed;
  border-radius: 3px;
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3' fill='none' stroke='%23ff2d55' stroke-width='1.4'/%3E%3C/svg%3E") repeat-x left bottom / 8px 4px,
    rgba(255, 45, 85, 0.13);
  box-shadow: 0 0 0 1px rgba(255, 45, 85, 0.18);
  animation: ctp-hl-breathe 2.6s ease-in-out infinite;
}
.ctp-hl[data-pending] { opacity: 0; animation: none; }
.ctp-hl--enter { animation: ctp-hl-enter 900ms ease-out, ctp-hl-breathe 2.6s ease-in-out 900ms infinite; }
@keyframes ctp-hl-enter {
  0% { background-color: rgba(255, 45, 85, 0.75); box-shadow: 0 0 24px 6px rgba(255, 45, 85, 0.8); }
  100% { background-color: rgba(255, 45, 85, 0.13); box-shadow: 0 0 0 1px rgba(255, 45, 85, 0.18); }
}
@keyframes ctp-hl-breathe {
  50% { background-color: rgba(255, 45, 85, 0.2); box-shadow: 0 0 10px 1px rgba(255, 45, 85, 0.25); }
}

/* The tag pinned to the start of the fallacy */
.ctp-tag {
  position: fixed;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px 0 6px;
  border: 0;
  border-radius: 5px 5px 5px 1px;
  background: linear-gradient(180deg, #ff3b5f 0%, #d1002f 100%);
  color: #fff;
  font: 800 10.5px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(209, 0, 47, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  animation: ctp-tag-glow 2.6s ease-in-out infinite;
  transform-origin: 0 100%;
}
.ctp-tag::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -5px;
  border-left: 6px solid #d1002f;
  border-bottom: 5px solid transparent;
}
.ctp-tag[data-below] { border-radius: 1px 5px 5px 5px; }
.ctp-tag[data-below]::after { top: -5px; bottom: auto; border-bottom: 0; border-top: 5px solid transparent; border-left-color: #ff3b5f; }
.ctp-tag:hover, .ctp-tag[aria-expanded="true"] { filter: brightness(1.12); }
.ctp-tag:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.ctp-tag[data-pending] { visibility: hidden; }
.ctp-tag svg { width: 12px; height: 12px; flex: none; }
.ctp-tag--enter { animation: ctp-tag-enter 520ms cubic-bezier(.2, 1.6, .4, 1), ctp-tag-glow 2.6s ease-in-out 520ms infinite; }
@keyframes ctp-tag-enter {
  0% { transform: scale(0.2) rotate(-12deg); opacity: 0; }
  35% { transform: scale(1.35) rotate(3deg); opacity: 1; text-shadow: -2px 0 #00e5ff, 2px 0 #ffd60a; }
  55% { transform: scale(0.94) skewX(-8deg); text-shadow: 2px 0 #00e5ff, -2px 0 #ffd60a; }
  75% { transform: scale(1.04) skewX(4deg); text-shadow: none; }
  100% { transform: none; }
}
@keyframes ctp-tag-glow {
  50% { box-shadow: 0 3px 18px rgba(255, 45, 85, 0.75), inset 0 0 0 1px rgba(255, 255, 255, 0.3); }
}
.ctp-tag--leave { animation: ctp-leave 380ms ease-in forwards; }
@keyframes ctp-leave { to { transform: translateY(-14px) scale(0.6); opacity: 0; } }

/* Explanation card */
.ctp-card {
  position: fixed;
  pointer-events: auto;
  width: 320px;
  max-width: calc(100vw - 24px);
  padding: 14px 16px 12px;
  border-radius: 10px;
  background: #170a0d;
  color: #f6e9eb;
  border-top: 3px solid #ff2d55;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 45, 85, 0.25);
  font: 400 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  animation: ctp-card-in 180ms ease-out;
}
@keyframes ctp-card-in { from { opacity: 0; transform: translateY(-6px); } }
.ctp-card h3 { margin: 0 0 2px; font: 800 15px/1.2 ui-sans-serif, system-ui, sans-serif; color: #ff4d6d; letter-spacing: 0.02em; }
.ctp-card .meta { margin: 0 0 10px; font-size: 11px; color: #b38f96; }
.ctp-card .quote { margin: 0 0 10px; padding-left: 9px; border-left: 2px solid #ff2d55; color: #e2c9ce; font-style: italic; }
.ctp-card .why { margin: 0 0 10px; }
.ctp-card .ask { margin: 0 0 12px; padding: 8px 10px; border-radius: 7px; background: rgba(255, 214, 10, 0.08); color: #ffe48a; }
.ctp-card .ask b { display: block; margin-bottom: 2px; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #ffd60a; }
.ctp-card .actions { display: flex; gap: 8px; justify-content: flex-end; }
.ctp-card button {
  font: 600 12px/1 ui-sans-serif, system-ui, sans-serif;
  padding: 7px 11px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: transparent;
  color: #f6e9eb;
  cursor: pointer;
}
.ctp-card button.primary { background: #ff2d55; border-color: #ff2d55; color: #fff; }
.ctp-card button:hover { filter: brightness(1.15); }

/* Entrance effects */
.ctp-stamp {
  position: fixed;
  left: 0;
  top: 0;
  padding: 7px 16px 6px;
  border: 4px solid #ff2d55;
  outline: 2px solid #ff2d55;
  outline-offset: 3px;
  border-radius: 6px;
  background: rgba(23, 4, 9, 0.88);
  color: #ff2d55;
  font: 900 30px/1 Impact, "Arial Black", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 0 16px rgba(255, 45, 85, 0.85);
  box-shadow: 0 0 46px rgba(255, 45, 85, 0.65), inset 0 0 18px rgba(255, 45, 85, 0.35);
  will-change: transform, opacity;
}
.ctp-stamp small { display: block; margin-top: 4px; font: 700 10px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.3em; color: #ffd60a; text-shadow: none; }
.ctp-stamp--max { font-size: 44px; }
.ctp-vignette {
  position: fixed;
  inset: 0;
  box-shadow: inset 0 0 160px 40px rgba(255, 0, 48, 0.75);
  background: radial-gradient(ellipse at center, rgba(255, 0, 48, 0) 55%, rgba(255, 0, 48, 0.28) 100%);
}
.ctp-ember { position: fixed; left: 0; top: 0; border-radius: 50%; will-change: transform, opacity; }
.ctp-ring { position: fixed; left: 0; top: 0; border: 3px solid #ff2d55; border-radius: 50%; }
.ctp-bar { position: fixed; left: 0; right: 0; height: 9vh; background: #000; }
.ctp-banner {
  position: fixed;
  left: 50%;
  top: 4.5vh;
  transform: translate(-50%, -50%);
  padding: 10px 22px;
  border-radius: 4px;
  background: #000;
  color: #fff;
  font: 900 22px/1 Impact, "Arial Black", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: -2px 0 #00e5ff, 2px 0 #ff2d55;
}
.ctp-fixed {
  position: fixed;
  left: 0;
  top: 0;
  padding: 5px 11px;
  border: 3px solid #1fd17a;
  border-radius: 6px;
  background: rgba(3, 26, 14, 0.9);
  color: #1fd17a;
  font: 900 16px/1 Impact, "Arial Black", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: 0 0 24px rgba(31, 209, 122, 0.55);
}
.ctp-status {
  position: fixed;
  right: 14px;
  bottom: 14px;
  max-width: 340px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #170a0d;
  color: #f6e9eb;
  border-left: 3px solid #ffd60a;
  font: 500 12px/1.4 ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  animation: ctp-card-in 180ms ease-out;
}
`;
