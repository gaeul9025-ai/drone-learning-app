import { readFileSync, writeFileSync } from "node:fs";

const path = "index.html";
let html = readFileSync(path, "utf8");

// The v1.1.0 UI is generated from the existing drone question bank in this build step.
// Once installed, repeated workflow runs are intentionally no-ops.
if (html.includes("v110-law-01") && html.includes("id=&quot;quizPage&quot;")) {
  console.log("v1.1.0 app already installed; nothing to patch.");
  process.exit(0);
}

const frameAt = html.indexOf('<iframe id="droneFrame"');
const attrAt = html.indexOf('srcdoc="', frameAt);
if (frameAt < 0 || attrAt < 0) throw new Error("Could not locate droneFrame srcdoc.");
const srcStart = attrAt + 'srcdoc="'.length;
const srcEnd = html.indexOf('"', srcStart);
if (srcEnd < 0) throw new Error("Could not locate end of droneFrame srcdoc.");

const decode = (s) => s
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&#x27;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&amp;", "&");
const encode = (s) => s
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const oldSrc = decode(html.slice(srcStart, srcEnd));
const marker = "const QUESTIONS=";
const qMarker = oldSrc.indexOf(marker);
if (qMarker < 0) throw new Error("Existing QUESTIONS array was not found.");
let arrayStart = qMarker + marker.length;
while (/\s/.test(oldSrc[arrayStart])) arrayStart++;
if (oldSrc[arrayStart] !== "[") throw new Error("Existing QUESTIONS data is not an array.");
let depth = 0, inString = false, escaped = false, arrayEnd = -1;
for (let i = arrayStart; i < oldSrc.length; i++) {
  const ch = oldSrc[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === '"') inString = false;
    continue;
  }
  if (ch === '"') inString = true;
  else if (ch === "[") depth++;
  else if (ch === "]") {
    depth--;
    if (depth === 0) { arrayEnd = i + 1; break; }
  }
}
if (arrayEnd < 0) throw new Error("Could not safely parse existing QUESTIONS array.");
const oldQuestions = JSON.parse(oldSrc.slice(arrayStart, arrayEnd));
const subjectMap = { law: "항공법규", weather: "항공기상", flight: "비행이론 및 운용", operation: "비행이론 및 운용" };
const questions = oldQuestions.map(q => ({
  id: String(q.id),
  subject: subjectMap[q.subject] || "비행이론 및 운용",
  question: String(q.q || ""),
  choices: Array.isArray(q.o) ? q.o.slice(0, 4).map(String) : ["", "", "", ""],
  answer: Number.isInteger(q.a) && q.a >= 0 && q.a < 4 ? q.a : 0,
  explanation: String(q.explain || (Array.isArray(q.e) ? q.e[q.a] : "") || "교재의 관련 개념을 다시 확인하세요."),
  image: null
}));

const additions = [
["v110-law-01","항공법규","초경량비행장치를 비행하기 전에 가장 먼저 확인해야 할 사항은?",["비행 장소의 공역과 승인 필요 여부","기체 외관 색상","조종기 화면 밝기","프로펠러 제조사"],0,"비행 장소에 따라 비행승인이나 별도 절차가 필요할 수 있다. 비행 전에는 공역 정보와 적용되는 제한 사항을 먼저 확인해야 한다."],
["v110-law-02","항공법규","조종자가 비행 중 가장 우선하여 지켜야 하는 원칙은?",["비행 시간을 최대한 늘린다","사람과 재산의 안전을 우선한다","기체를 항상 최고 속도로 운용한다","배터리를 완전히 소모한다"],1,"비행의 최우선 기준은 사람과 재산의 안전이다. 위험이 예상되거나 안전한 비행이 어렵다면 비행을 중단하거나 안전한 장소에 착륙해야 한다."],
["v110-law-03","항공법규","비행 중 기체가 시야에서 가려질 우려가 있을 때 적절한 조치는?",["속도를 높여 계속 비행한다","기체를 더 멀리 보낸다","시계가 확보되는 안전한 비행 경로를 유지한다","조종기를 끈다"],2,"기체의 위치와 자세를 확인할 수 있도록 시계를 확보해야 한다. 주변 장애물과 사람을 고려해 안전한 경로로 비행해야 한다."],
["v110-law-04","항공법규","비행 장소가 공항 주변 또는 제한 구역인지 불확실하다. 가장 적절한 행동은?",["낮은 고도면 무조건 비행한다","주변 사람이 없으면 비행한다","다른 기체를 따라 비행한다","공식 공역 정보를 확인하고 필요한 절차를 이행한다"],3,"장소만 보고 비행 가능 여부를 단정해서는 안 된다. 공식 공역 정보와 해당 장소의 제한 사항을 확인하고 필요한 승인 절차를 이행해야 한다."],
["v110-law-05","항공법규","비행 중 안전에 영향을 줄 수 있는 상황이 발생했을 때 적절한 판단은?",["예정 경로를 무조건 유지한다","안전 확보를 우선해 비행을 중단하거나 착륙한다","촬영을 마친 뒤 대응한다","배터리 잔량과 관계없이 계속 비행한다"],1,"계획보다 실제 안전 상황이 우선이다. 위험 요인이 발생하면 비행을 중단하거나 안전한 장소에 착륙하는 등 위험을 줄이는 조치를 해야 한다."],
["v110-law-06","항공법규","비행 전 조종자가 확인할 사항으로 가장 적절하지 않은 것은?",["비행 장소의 제한 사항","기상과 주변 장애물","기체의 안전 상태","기체 외관 색상이 주변 풍경과 어울리는지"],3,"비행 전 점검은 공역, 기상, 주변 환경과 기체의 안전 상태를 중심으로 한다. 외관 색상과 풍경의 조화는 필수 안전 점검 항목이 아니다."],
["v110-law-07","항공법규","다른 항공기나 비행체와 충돌 위험이 예상될 때 우선해야 할 행동은?",["상대가 양보할 것이라 기대하며 직진한다","촬영 화면을 확인한다","충돌 위험을 줄이는 방향으로 안전 조치를 한다","반응을 기다리며 계속 비행한다"],2,"충돌 위험이 예상되면 상대가 피할 것이라고 가정해서는 안 된다. 주변 상황을 확인하고 위험을 줄이는 안전 조치를 신속하게 해야 한다."],
["v110-law-08","항공법규","비행 계획을 세울 때 법적 제한과 안전 조건이 서로 맞지 않는다면?",["법적 제한과 안전 조건을 모두 충족할 때만 비행한다","안전 조건만 충족하면 비행한다","법적 제한은 비행 후 확인한다","짧게 비행하면 제한을 무시해도 된다"],0,"안전한 비행을 위해서는 법적 요건과 현장 안전 조건을 모두 충족해야 한다. 어느 하나라도 충족하지 못하면 비행을 진행하지 않아야 한다."],
["v110-weather-01","항공기상","METAR는 주로 어떤 정보를 제공하는가?",["기체 정비 이력","공항의 관측 기상 정보","조종자 자격 정보","배터리 충전 상태"],1,"METAR는 공항에서 관측한 현재 기상 정보를 정해진 형식으로 보고한 것이다. 바람, 시정, 구름, 기온과 기압 등의 정보를 파악하는 데 사용한다."],
["v110-weather-02","항공기상","안개가 짙어져 시정이 나빠질 때 드론 운용에서 가장 직접적으로 커지는 위험은?",["프로펠러 회전수가 자동으로 증가하는 위험","배터리 전압이 항상 높아지는 위험","기체 위치와 장애물을 확인하기 어려운 위험","GPS 위성 수가 반드시 증가하는 위험"],2,"시정이 나빠지면 조종자가 기체와 주변 장애물을 육안으로 확인하기 어려워진다. 시계 확보가 어려운 상황에서는 무리하게 비행하지 말고 안전한 착륙을 고려해야 한다."],
["v110-weather-03","항공기상","기상 보고에서 풍향은 일반적으로 무엇을 기준으로 나타내는가?",["바람이 불어가는 방향","기체가 향하는 방향","활주로 번호","바람이 불어오는 방향"],3,"풍향은 바람이 불어오는 방향을 기준으로 표현한다. 따라서 북풍은 북쪽에서 남쪽으로 부는 바람을 뜻한다."],
["v110-weather-04","항공기상","뇌우가 예상되는 지역에서 비행을 피해야 하는 주된 이유는?",["강한 상승·하강 기류와 돌풍 등 위험한 기상 현상","구름이 항상 낮게 형성되기 때문","기압이 변하지 않기 때문","시정이 반드시 좋아지기 때문"],0,"뇌우 주변에는 강한 상승·하강 기류와 돌풍, 번개 등 위험한 현상이 동반될 수 있다. 소형 무인비행장치는 이런 변화에 취약하므로 접근을 피해야 한다."],
["v110-weather-05","항공기상","기온이 높고 공기 밀도가 낮아질 때 일반적으로 나타날 수 있는 영향은?",["프로펠러가 필요 없어짐","기체의 양력과 추진 성능이 저하될 수 있음","배터리 용량이 무조건 두 배가 됨","바람이 항상 사라짐"],1,"공기 밀도가 낮으면 같은 조건에서 로터가 만들어 내는 양력과 추진 성능이 저하될 수 있다. 고온 환경에서는 기체 성능과 배터리 상태를 함께 고려해야 한다."],
["v110-weather-06","항공기상","산악 지형에서 바람이 강하게 불 때 특히 주의해야 할 현상은?",["기압계가 항상 고정되는 현상","구름이 전혀 생기지 않는 현상","난류와 산악파 등 불규칙한 기류","풍향이 존재하지 않는 현상"],2,"산악 지형에서는 지형을 넘는 바람 때문에 난류나 산악파가 발생할 수 있다. 기체가 갑작스러운 기류 변화에 노출될 수 있으므로 지형과 풍속을 고려해야 한다."],
["v110-weather-07","항공기상","기압 변화를 해석할 때 일반적으로 유의해야 할 점은?",["기압만으로 모든 기상 현상을 확정할 수 있다","기압은 비행 안전과 관계가 없다","기압이 낮으면 바람은 항상 멈춘다","기압과 다른 기상 관측을 함께 살펴야 한다"],3,"기압 변화는 기상 변화의 단서가 될 수 있지만 그것만으로 모든 현상을 단정할 수는 없다. 풍향·풍속, 구름, 강수와 같은 다른 관측 정보도 함께 확인해야 한다."],
["v110-weather-08","항공기상","비행 전 바람을 확인할 때 평균 풍속 외에 함께 고려할 요소는?",["돌풍과 풍향 변화","조종기 케이스 색상","기체 이름의 길이","화면 밝기 설정"],0,"평균 풍속이 낮더라도 돌풍이나 풍향 변화가 크면 기체 제어가 어려워질 수 있다. 현장의 바람 변화를 확인하고 기체 운용 한계 안에서 비행해야 한다."],
["v110-flight-01","비행이론 및 운용","멀티콥터에서 무게중심이 설계 범위를 벗어나면 발생할 수 있는 문제는?",["배터리 전압이 자동으로 일정해짐","기체가 항상 더 안정적으로 비행함","자세 제어와 모터별 추력 분배가 어려워짐","GPS가 필요 없어짐"],2,"무게중심이 적절한 위치에서 벗어나면 균형을 유지하기 위해 더 큰 보정 추력이 필요할 수 있다. 심한 편중은 자세 제어와 비행 안정성을 떨어뜨린다."],
["v110-flight-02","비행이론 및 운용","전자변속기(ESC)의 주요 역할은?",["모터에 공급되는 전력을 제어해 회전 속도를 조절한다","위성 위치를 계산한다","기체의 무게중심을 이동시킨다","배터리 셀을 물리적으로 냉각한다"],0,"ESC는 비행 제어기의 명령에 따라 모터에 공급되는 전력을 제어한다. 멀티콥터에서는 모터 회전 속도를 조절해 자세와 추력을 제어하는 데 관여한다."],
["v110-flight-03","비행이론 및 운용","리튬폴리머 배터리를 충전할 때 가장 적절한 방법은?",["충전 중 자리를 비우고 장시간 방치한다","전용 충전기를 사용하고 충전 상태를 확인한다","셀 수와 관계없이 전압을 임의로 설정한다","손상된 배터리도 계속 충전한다"],1,"배터리의 셀 수와 규격에 맞는 충전기를 사용하고 충전 중 상태를 확인해야 한다. 부풀거나 손상된 배터리는 사용과 충전을 중단하고 안전 절차에 따라 처리해야 한다."],
["v110-flight-04","비행이론 및 운용","멀티콥터의 요(Yaw) 운동은 어떤 움직임인가?",["기체가 앞뒤로 기울어지는 움직임","기체가 좌우로 기울어지는 움직임","기체가 위아래로 이동하는 움직임","수직축을 중심으로 기체 방향이 회전하는 움직임"],3,"요 운동은 기체의 수직축을 중심으로 기수가 좌우 방향으로 회전하는 움직임이다. 피치와 롤은 각각 앞뒤 및 좌우 기울기와 구분해야 한다."],
["v110-flight-05","비행이론 및 운용","프로펠러를 교체한 뒤 이륙 전에 해야 할 일로 가장 적절한 것은?",["장착 방향과 고정 상태를 확인한다","최대 출력으로 바로 이륙한다","고정 상태는 비행 후 확인한다","배터리를 연결한 상태에서 손으로 회전시킨다"],0,"프로펠러는 회전 방향과 장착 위치가 맞아야 하며 고정 상태도 안전해야 한다. 점검 중에는 모터가 갑자기 작동하지 않도록 전원을 분리한 상태에서 확인해야 한다."],
["v110-flight-06","비행이론 및 운용","자동 복귀(RTH) 기능을 사용할 때 사전에 확인할 사항은?",["기체 외관 색상만 확인한다","복귀 고도와 복귀 지점 설정이 적절한지 확인한다","배터리 잔량을 무시한다","복귀 중에는 장애물을 고려하지 않는다"],1,"RTH는 설정된 복귀 지점과 고도, 기체의 비행 조건에 따라 작동한다. 복귀 경로에 장애물이 있을 수 있으므로 설정을 확인하고 작동 중에도 주변 상황을 감시해야 한다."],
["v110-flight-07","비행이론 및 운용","비행 전 프로펠러에 균열이나 변형이 발견되었다. 올바른 조치는?",["진동이 생겨도 그대로 사용한다","속도를 낮추면 계속 사용할 수 있다","비행을 중단하고 손상된 프로펠러를 교체한다","반대쪽 프로펠러만 제거한다"],2,"손상된 프로펠러는 회전 중 파손이나 진동을 일으켜 기체 제어에 영향을 줄 수 있다. 비행을 시작하지 말고 규격에 맞는 정상 부품으로 교체해야 한다."],
["v110-flight-08","비행이론 및 운용","멀티콥터가 수평을 유지하며 제자리에서 호버링할 때 필요한 조건은?",["추력이 중력보다 항상 훨씬 작아야 한다","모든 모터가 반드시 같은 회전수여야 한다","기체의 무게중심이 없어야 한다","전체 추력이 중력과 균형을 이루고 자세가 안정되어야 한다"],3,"수평 호버링에서는 전체 추력이 중력과 균형을 이루어야 한다. 바람이나 무게중심 편차가 있으면 모터별 추력이 달라질 수 있으므로 모든 모터의 회전수가 같을 필요는 없다."]
].map(([id,subject,question,choices,answer,explanation])=>({id,subject,question,choices,answer,explanation,image:null}));
const seen = new Set(questions.map(q => q.question.toLowerCase().replace(/\s+/g," ").trim()));
let appended = 0;
for (const [id,subject,question,choices,answer,explanation] of additions) {
  const key = question.toLowerCase().replace(/\s+/g," ").trim();
  if (!seen.has(key)) { questions.push({id,subject,question,choices,answer,explanation,image:null}); seen.add(key); appended++; }
}
const template = readFileSync(".github/scripts/drone-v110-template.html", "utf8");
const questionJson = JSON.stringify(questions).replace(/<\/script/gi, "<\\/script");
const app = template.replace("__QUESTIONS_JSON__", questionJson);
if (app.includes("__QUESTIONS_JSON__")) throw new Error("Question data placeholder was not replaced.");
html = html.slice(0, srcStart) + encode(app) + html.slice(srcEnd);

const styleEnd = html.indexOf("</style>");
if (styleEnd < 0) throw new Error("Outer stylesheet closing tag was not found.");
const cssPatch = "\n/* v1.1.0: the drone app uses the full viewport; the robot app remains separate */\n.shell:has(#droneFrame.active)>.top,.shell:has(#droneFrame.active)>.foot{display:none!important}.shell:has(#droneFrame.active)>.view{height:100dvh;min-height:100dvh;flex:1}\n";
if (!html.includes("v1.1.0: the drone app uses the full viewport")) html = html.slice(0, styleEnd) + cssPatch + html.slice(styleEnd);
const oldEntry = "document.getElementById('openDrone').onclick=()=>show('drone');document.getElementById('openRobot').onclick=()=>show('robot');back.onclick=showLauncher;showLauncher();";
const newEntry = "document.getElementById('openDrone').onclick=()=>show('drone');document.getElementById('openRobot').onclick=()=>show('robot');back.onclick=showLauncher;window.addEventListener('message',e=>{if(e.data&&e.data.type==='open-robot')show('robot')});show('drone');";
if (html.includes(oldEntry)) html = html.replace(oldEntry, newEntry);
if (!html.includes("id=&quot;quizPage&quot;") || !html.includes("v110-law-01") || !html.includes("1.1.0")) throw new Error("v1.1.0 output verification failed.");
if (!html.includes('id="robotFrame"')) throw new Error("The existing MobileRobot app was not preserved.");
writeFileSync(path, html, "utf8");
console.log(JSON.stringify({oldQuestions:oldQuestions.length,appendedQuestions:appended,totalQuestions:questions.length,htmlBytes:Buffer.byteLength(html),message:"v1.1.0 app generated and validated"}));
