import { readFileSync, writeFileSync } from "node:fs";

const path = "index.html";
const html = readFileSync(path, "utf8");
const marker = "CODEX_WHITE_THEME_FIX_V1";
const frameStart = html.indexOf('id="droneFrame"');
const robotFrameStart = html.indexOf('id="robotFrame"', frameStart + 1);
const styleEnd = html.indexOf("&lt;/style&gt;", frameStart);

if (frameStart < 0 || robotFrameStart < 0 || styleEnd < 0 || styleEnd > robotFrameStart) {
  throw new Error("Could not safely locate the embedded drone app stylesheet.");
}
if (html.slice(frameStart, robotFrameStart).includes(marker)) {
  console.log("White-theme fix already present; no changes made.");
  process.exit(0);
}

const css = `
/* CODEX_WHITE_THEME_FIX_V1: restore light surfaces in sticky navigation and quiz header */
body.light .top,
body.light .quizHeader {
  background: rgba(255,255,255,.97) !important;
  color: var(--text) !important;
  border-color: var(--line) !important;
  backdrop-filter: blur(10px);
}
body.light .bottomNav,
body.light .mobileNav {
  background: rgba(255,255,255,.98) !important;
  color: var(--text) !important;
  border-top-color: var(--line) !important;
  backdrop-filter: blur(12px);
}
body.light .topVer,
body.light .ver { color: var(--muted) !important; }
body.light .navBtn { color: var(--muted) !important; }
body.light .navBtn.on {
  background: var(--panel2) !important;
  border-color: var(--line2) !important;
  color: var(--text) !important;
}
`;
const encoded = css.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const updated = html.slice(0, styleEnd) + encoded + html.slice(styleEnd);
writeFileSync(path, updated, "utf8");
console.log("Patched embedded drone app light-theme CSS.");
