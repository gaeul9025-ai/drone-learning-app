import { readFileSync, writeFileSync } from "node:fs";

const path = "index.html";
let html = readFileSync(path, "utf8");

// Safely patch the embedded drone app's question and explanation UI.
const frameStart0 = html.indexOf('id="droneFrame"');
const robotFrameStart0 = html.indexOf('id="robotFrame"', frameStart0 + 1);
if (frameStart0 < 0 || robotFrameStart0 < 0) throw new Error("Could not safely locate the embedded drone app.");
const encodeSrcdoc = (value) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
function replaceFunction(name, nextName, body) {
  const a = html.indexOf(`function ${name}`, frameStart0);
  const b = html.indexOf(`function ${nextName}`, a + 1);
  if (a < frameStart0 || b < 0 || b > robotFrameStart0) throw new Error(`Could not locate ${name} safely.`);
  html = html.slice(0, a) + encodeSrcdoc(body) + html.slice(b);
}
replaceFunction("coreQuestion(q){", "explainType(q){", `function coreQuestion(q){
  let s=clean(q.q||'');
  if(q && /-app\\d+$/.test(String(q.id||''))){
    const chunks=s.split(/\\n\\s*\\n/).map(x=>clean(x)).filter(Boolean);
    if(chunks.length > 1) s=chunks[chunks.length-1];
  }
  const parts=s.split(/\\n+/).map(x=>clean(x)).filter(Boolean);
  if(parts.length > 1 && /^(교재 내용을 기준|다음 상황 또는 설명|핵심 개념을 정확히|비행·학습 현장에서|기체 점검 중|운용 담당자가|점검표에서 최종 판단|상황을 살펴보면|다음과 같은 상황|다음 사례|현장에서는|현장 점검에서|비행 전 점검에서|점검 과정에서|기체 운용 중|조종자가|운용자가|담당자는|운영자가|작업자가|실습 중|비행 중|비행을 준비하던|확인 결과)/.test(parts[0])) s=parts[parts.length-1];
  s=s.replace(/^비행이론에서 다음 두 선택지\\s*/, '');
  s=s.replace(/^항공기상에서 다음 두 선택지\\s*/, '');
  s=s.replace(/^드론 운용에서 다음 두 선택지\\s*/, '');
  s=s.replace(/^항공법규에서 다음 두 선택지\\s*/, '');
  s=s.replace(/\\s+관해 교재 기준과 맞는 선택은\\?$/, '?');
  s=s.replace(/\\s+에 관해 교재 기준과 맞는 선택은\\?$/, '?');
  return clean(s);
}
`);
replaceFunction("baseQuestionText(q){", "conceptText(q){", `function baseQuestionText(q){
  return clean(coreQuestion(q))
    .replace(/^교재 내용을 기준으로 판단할 때, 다음 중 가장 알맞은 것은\\?\\s*/, '')
    .replace(/^다음 상황 또는 설명을 교재의 기준에 맞춰 판단하시오\\.\\s*/, '')
    .replace(/^핵심 개념을 정확히 구분한 것으로 가장 적절한 것은\\?\\s*/, '')
    .replace(/^비행·학습 현장에서 적용할 때 교재 내용과 일치하는 선택지는\\?\\s*/, '')
    .trim();
}
`);
const memoStart = html.indexOf('&lt;details class=&quot;note&quot;&gt;', frameStart0);
if (memoStart >= 0 && memoStart < robotFrameStart0) {
  const memoEnd = html.indexOf('&lt;/details&gt;', memoStart);
  if (memoEnd < 0 || memoEnd > robotFrameStart0) throw new Error("Could not safely remove the memo UI.");
  html = html.slice(0, memoStart) + html.slice(memoEnd + '&lt;/details&gt;'.length);
}
const explanationBlocks = [
  {
    old: '&lt;div class=&quot;block explainBlock&quot;&gt;&lt;div class=&quot;blockHead&quot;&gt;왜 이렇게 판단하나&lt;/div&gt;&lt;div class=&quot;blockBody&quot;&gt;${esc(readableExplain(q))}&lt;/div&gt;&lt;/div&gt;',
    next: '&lt;details class=&quot;explainToggle&quot;&gt;&lt;summary&gt;해설 열기 / 닫기&lt;/summary&gt;&lt;div class=&quot;block explainBlock&quot;&gt;&lt;div class=&quot;blockHead&quot;&gt;왜 이렇게 판단하나&lt;/div&gt;&lt;div class=&quot;blockBody&quot;&gt;${esc(readableExplain(q))}&lt;/div&gt;&lt;/div&gt;&lt;/details&gt;'
  },
  {
    old: '&lt;div class=&quot;block&quot;&gt;&lt;div class=&quot;blockHead&quot;&gt;내가 고른 답을 다시 보기&lt;/div&gt;&lt;div class=&quot;blockBody&quot;&gt;${esc(selectedExplain(q,answer,unknown))}&lt;/div&gt;&lt;/div&gt;',
    next: '&lt;details class=&quot;explainToggle&quot;&gt;&lt;summary&gt;내가 고른 답 해설 열기 / 닫기&lt;/summary&gt;&lt;div class=&quot;block&quot;&gt;&lt;div class=&quot;blockHead&quot;&gt;내가 고른 답을 다시 보기&lt;/div&gt;&lt;div class=&quot;blockBody&quot;&gt;${esc(selectedExplain(q,answer,unknown))}&lt;/div&gt;&lt;/div&gt;&lt;/details&gt;'
  }
];
for (const item of explanationBlocks) {
  // Each "next" block intentionally contains the original block. Normalize
  // any wrappers from older runs before checking for the canonical single wrapper.
  const innerAt = item.next.indexOf(item.old);
  if (innerAt < 0) throw new Error("Invalid explanation wrapper definition.");
  const prefix = item.next.slice(0, innerAt);
  const suffix = item.next.slice(innerAt + item.old.length);
  let normalized = true;
  while (normalized) {
    normalized = false;
    for (let depth = 12; depth >= 2; depth--) {
      const repeated = prefix.repeat(depth) + item.old + suffix.repeat(depth);
      const atRepeated = html.indexOf(repeated, frameStart0);
      if (atRepeated >= frameStart0 && atRepeated < robotFrameStart0) {
        html = html.slice(0, atRepeated) + item.next + html.slice(atRepeated + repeated.length);
        normalized = true;
      }
    }
  }
  const alreadyPatched = html.indexOf(item.next, frameStart0);
  if (alreadyPatched >= frameStart0 && alreadyPatched < robotFrameStart0) continue;
  const at = html.indexOf(item.old, frameStart0);
  if (at >= frameStart0 && at < robotFrameStart0) {
    html = html.slice(0, at) + item.next + html.slice(at + item.old.length);
  } else {
    throw new Error("Could not find the explanation UI to patch or verify.");
  }
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
/* Fix hard-coded dark explanation cards in light mode, not just their text. */
body.light .block,
body.light details,
body.light .explainToggle,
body.light .bookBlock,
body.light .optionDetails details {
  background: #ffffff !important;
  color: #17212b !important;
  border-color: #d7dee7 !important;
}
body.light .blockHead,
body.light details > summary,
body.light .explainToggle > summary {
  background: #f3f6f9 !important;
  color: #17212b !important;
}
body.light .blockBody,
body.light .bookBlock .blockBody,
body.light .oe { color: #17212b !important; }
.explainToggle { margin-top: 8px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel); overflow: hidden; }
.explainToggle > summary { cursor: pointer; padding: 10px 12px; color: var(--text); font-weight: 800; list-style: none; }
.explainToggle > summary::-webkit-details-marker { display: none; }
.explainToggle > .block { margin: 0; border: 0; border-radius: 0; }
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

// Fail the workflow if the final embedded app is missing any intended UI fix.
const verifiedFrameStart = html.indexOf('id="droneFrame"');
const verifiedRobotFrameStart = html.indexOf('id="robotFrame"', verifiedFrameStart + 1);
const verifiedDroneSrcdoc = html.slice(verifiedFrameStart, verifiedRobotFrameStart);
const requiredFinalMarkers = [
  marker,
  "body.light .block",
  "body.light details > summary",
  "해설 열기 / 닫기",
  "내가 고른 답 해설 열기 / 닫기"
];
for (const required of requiredFinalMarkers) {
  if (!verifiedDroneSrcdoc.includes(required)) {
    throw new Error("Final verification failed; missing marker: " + required);
  }
}
const countOccurrences = (haystack, needle) => haystack.split(needle).length - 1;
for (const summary of [
  '&lt;details class=&quot;explainToggle&quot;&gt;&lt;summary&gt;해설 열기 / 닫기',
  '&lt;details class=&quot;explainToggle&quot;&gt;&lt;summary&gt;내가 고른 답 해설 열기 / 닫기'
]) {
  if (countOccurrences(verifiedDroneSrcdoc, summary) !== 1) {
    throw new Error("Final verification failed; an explanation toggle is missing or duplicated.");
  }
}
if (verifiedDroneSrcdoc.includes('&lt;details class=&quot;note&quot;&gt;')) {
  throw new Error("Final verification failed; memo UI markup is still present.");
}
writeFileSync(path, html, "utf8");
console.log("Verified: light explanation cards, collapsible explanations, no memo UI; wrote index.html.");
