// ─── APP THEME ────────────────────────────────────────────────────────────────
const APP_THEMES = [
  {name:"Gold",      accent:"#b8860b", dark:"#9a6f09"},
  {name:"Slate",     accent:"#475569", dark:"#334155"},
  {name:"Indigo",    accent:"#4f46e5", dark:"#3730a3"},
  {name:"Teal",      accent:"#0d9488", dark:"#0f766e"},
  {name:"Rose",      accent:"#e11d48", dark:"#be123c"},
  {name:"Emerald",   accent:"#059669", dark:"#047857"},
];
let activeTheme=APP_THEMES[5]; // Default: Emerald

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const CONSTANTS = {
  DEFAULT_NODE_W: 40,
  DEFAULT_NODE_PAD: 16,
  DEFAULT_LABEL_SIZE: 10,
  DEFAULT_VALUE_LABEL_SIZE: 10,
  DEFAULT_HEIGHT: 600,
  DEFAULT_COL_SPACING: 150,
  MIN_H_FOR_INSIDE: 50,
  SVG_NS: "http://www.w3.org/2000/svg",
};
