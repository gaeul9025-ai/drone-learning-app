import { readFileSync, writeFileSync } from "node:fs";

const path = "index.html";
let html = readFileSync(path, "utf8");

// Normalize generated question display without changing the underlying answer bank.
const coreNeedle = "function coreQuestion(q){\n  let s=clean(q.q);";
const coreReplacement = coreNeedle + "\n  // Remove the artificial scenario and generic instruction from generated application variants.\n  if(q&&q.id&&/-app\\d+$/.test(q.id)){\n    const chunks=String(q.q||&quot;&quot;).split(/\\n\\s*\\n/).map(x=>clean(x)).filter(Boolean);\n    if(chunks.length>=3)s=chunks.slice(2).join(&quot;\\n\\n&quot;);\n  }";
if (html.includes(coreNeedle) && !html.includes("Remove the artificial scenario and generic instruction")) {
  html = html.replace(coreNeedle, coreReplacement);
}
const marker = "CODEX_WHITE_THEME_FIX_V1";
const frameStart = html.indexOf('id="droneFrame"');
const robotFrameStart = html.indexOf('id="robotFrame"', frameStart + 1);
if (frameStart < 0 || robotFrameStart < 0) {
  throw new Error("Could not safely locate the embedded drone app.");
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
body.light .opt {
  background: var(--panel) !important;
  color: var(--text) !important;
  border-color: var(--line) !important;
}
body.light .opt .num { color: var(--muted) !important; }
body.light .opt.sel {
  background: var(--blueBg) !important;
  border-color: var(--accent) !important;
}
body.light .opt.correct {
  background: var(--greenBg) !important;
  border-color: var(--ok) !important;
}
body.light .opt.wrong {
  background: var(--redBg) !important;
  border-color: var(--bad) !important;
}
/* CODEX_READABLE_QUESTION_NO_MEMO_V1 */
body.light .qText,
body.light .opt,
body.light .blockBody,
body.light .blockHead,
body.light .qRef,
body.light .sourceText,
body.light .qMeta,
body.light .pill {
  color: #17212b !important;
  text-shadow: none !important;
}
body.light .qText { font-size: 16px !important; line-height: 1.65 !important; font-weight: 750 !important; }
body.light .opt { font-size: 15px !important; line-height: 1.55 !important; font-weight: 600 !important; }
body.light .opt .num { color: #364554 !important; }
body.light .qRef, body.light .sourceText { color: #364554 !important; font-size: 12px !important; }
.note { display: none !important; }
`;
// The srcdoc stores HTML tags entity-escaped, but CSS inside a style element must remain plain CSS.
const injectedCss = css;

// Remove our previous insertion, wherever it was, so this remains idempotent.
const oldPos = html.indexOf(marker, frameStart);
if (oldPos >= 0 && oldPos < robotFrameStart) {
  const blockStart = html.lastIndexOf("\n", oldPos);
  const encodedStart = blockStart >= frameStart ? blockStart : oldPos;
  const oldBlockEnd = html.indexOf("&lt;/style&gt;", oldPos);
  const oldHeadEnd = html.indexOf("&lt;/head&gt;", oldPos);
  if (oldBlockEnd >= 0 && oldBlockEnd < robotFrameStart && (oldHeadEnd < 0 || oldBlockEnd < oldHeadEnd)) {
    html = html.slice(0, encodedStart) + html.slice(oldBlockEnd);
  } else {
    // Fallback for a previous version already placed after all style tags.
    const markerEnd = html.indexOf("}", html.indexOf("body.light .navBtn.on", oldPos));
    if (markerEnd < 0 || markerEnd > robotFrameStart) throw new Error("Could not safely remove previous patch.");
    const end = html.indexOf("\n", markerEnd);
    html = html.slice(0, encodedStart) + html.slice(end >= 0 ? end + 1 : markerEnd + 1);
  }
}

const newFrameStart = html.indexOf('id="droneFrame"');
const newRobotFrameStart = html.indexOf('id="robotFrame"', newFrameStart + 1);
const headEnd = html.indexOf("&lt;/head&gt;", newFrameStart);
if (headEnd < 0 || headEnd > newRobotFrameStart) {
  throw new Error("Could not safely locate the embedded drone app's closing head tag.");
}
const frameContent = html.slice(newFrameStart, headEnd);
if (frameContent.includes(marker)) throw new Error("Previous patch marker remains; refusing to duplicate CSS.");
const styleEnd = html.lastIndexOf("&lt;/style&gt;", headEnd);
if (styleEnd < newFrameStart) throw new Error("Could not safely locate the embedded drone app's final style closing tag.");

html = html.slice(0, styleEnd) + injectedCss + "\n" + html.slice(styleEnd);
writeFileSync(path, html, "utf8");
console.log("Placed the light-theme overrides inside the final embedded drone style element.");
