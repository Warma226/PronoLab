/* Prono Lab — application autonome (matchs + comptes + abonnements) */
const CFG = window.PL_CONFIG || {};
const PLANS = CFG.plans;
const LG = { ALL: "Tous", PL: "Premier League", LIGA: "Liga", SA: "Serie A", BL: "Bundesliga", L1: "Ligue 1", NHL: "NHL", KHL: "KHL", SHL: "SHL", LIIGA: "Liiga", NL: "National League", DEL: "DEL" };
const LGS = { PL: "PL", LIGA: "Liga", SA: "Serie A", BL: "Bundes.", L1: "L1", NHL: "NHL", KHL: "KHL", SHL: "SHL", LIIGA: "Liiga", NL: "NL", DEL: "DEL" };
const PAYS = [["orange", "Orange Money"], ["moov", "Moov Money"], ["wave", "Wave"]];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pc = p => Math.round(p * 100);
const fmt = (n, d = 2) => n.toFixed(d).replace(".", ",");
const cfa = n => n.toLocaleString("fr-FR") + " F CFA";
const dFmt = d => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const digits = s => String(s || "").replace(/\D/g, "");
const normPhone = s => { let d = digits(s); if (d.startsWith("00")) d = d.slice(2); if (d.length === 8) d = "226" + d; return d; };
const phoneEmail = s => normPhone(s) + "@pronolab.app";

let matches = [], filter = "ALL", sort = "time", open = new Set();
let fb = null, auth = null, fs = null, me = null, isOwner = false;
let myAcc = null, accLoaded = false, myMember = null, myReq = null, payment = {};
let reqs = [], members = {}, accounts = {}, unsubs = [], adminUnsubs = [];
let selPlan = "week", authTab = "create", asVisitor = false;
let skipped = false; try { skipped = localStorage.getItem("pl_skip") === "1"; } catch (e) {}

const owner = () => isOwner && !asVisitor;
const isMember = () => owner() || (!asVisitor && myMember && new Date(myMember.until) > new Date());

/* ---------- Modèle de pronostic ---------- */
function pois(l, k) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return Math.exp(-l) * Math.pow(l, k) / f; }
const ff = f => { f = String(f || ""); if (!f.length) return 1; const pts = [...f].reduce((s, v) => s + (v === "V" ? 3 : v === "N" ? 1 : 0), 0); return 0.9 + 0.2 * (pts / (3 * f.length)); };
function analyse(d) {
  const L = d.leagueAvg || 1.4, h = d.home, a = d.away;
  const att = t => (t.gf / Math.max(t.gp, 1)) / L, def = t => (t.ga / Math.max(t.gp, 1)) / L;
  const lh = Math.max(.1, L * att(h) * def(a) * 1.1 * ff(h.form)), la = Math.max(.1, L * att(a) * def(h) * .9 * ff(a.form));
  let p1 = 0, px = 0, p2 = 0, o25 = 0, btts = 0; const sc = [];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const p = pois(lh, i) * pois(la, j);
    if (i > j) p1 += p; else if (i === j) px += p; else p2 += p;
    if (i + j > 2) o25 += p; if (i && j) btts += p; if (i <= 5 && j <= 5) sc.push([i, j, p]);
  }
  const t = p1 + px + p2; p1 /= t; px /= t; p2 /= t; sc.sort((x, y) => y[2] - x[2]);
  const opts = [["1", p1, "Victoire " + h.name], ["N", px, "Match nul"], ["2", p2, "Victoire " + a.name]];
  let best = opts.reduce((x, y) => y[1] > x[1] ? y : x);
  if (best[1] < .45) best = p1 >= p2 ? ["1N", p1 + px, h.name + " ou nul"] : ["N2", p2 + px, a.name + " ou nul"];
  const cls = best[1] >= .6 ? "fort" : best[1] >= .45 ? "moyen" : "risque";
  return { lh, la, p1, px, p2, o25, btts, sc: sc.slice(0, 5), pick: best[0], pickLabel: best[2], conf: best[1], cls };
}

// Hockey : même principe (loi de Poisson), avantage de la glace plus faible, prolongation prise en compte
function analyseH(d) {
  const L = d.leagueAvg || 3, h = d.home, a = d.away;
  const att = t => (t.gf / Math.max(t.gp, 1)) / L, def = t => (t.ga / Math.max(t.gp, 1)) / L;
  const lh = Math.max(.3, L * att(h) * def(a) * 1.05 * ff(h.form)), la = Math.max(.3, L * att(a) * def(h) * .95 * ff(a.form));
  let p1 = 0, px = 0, p2 = 0, o55 = 0; const sc = [];
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
    const p = pois(lh, i) * pois(la, j);
    if (i > j) p1 += p; else if (i === j) px += p; else p2 += p;
    if (i + j > 5) o55 += p; if (i <= 7 && j <= 7) sc.push([i, j, p]);
  }
  const t = p1 + px + p2; p1 /= t; px /= t; p2 /= t; sc.sort((x, y) => y[2] - x[2]);
  const w1 = p1 + px * lh / (lh + la), w2 = 1 - w1;      // vainqueur, prolongation et tirs au but inclus
  const best = w1 >= w2 ? ["1", w1, "Victoire " + h.name + " (prol. incluse)"] : ["2", w2, "Victoire " + a.name + " (prol. incluse)"];
  const cls = best[1] >= .6 ? "fort" : best[1] >= .45 ? "moyen" : "risque";
  return { hockey: true, lh, la, p1, px, p2, w1, w2, o55, o25: o55, btts: 0, sc: sc.slice(0, 5), pick: best[0], pickLabel: best[2], conf: best[1], cls };
}
const analyseAny = m => m.sport === "hockey" ? analyseH(m) : analyse(m);

/* ---------- Affichage des matchs ---------- */
const formHtml = f => '<span class="form" aria-label="Forme : ' + esc(f) + '">' + [...String(f || "")].map(v => '<i class="f' + v + '"></i>').join("") + "</span>";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const hFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const CL = { fort: "Fort", moyen: "Moyen", risque: "Risqué" };
const LOCKD = `<div class="lockdet"><span>Buts attendus, scores probables et marchés : réservé aux membres.</span><button class="cta" data-join>Devenir membre</button></div>`;

/* ---------- Logos des équipes (fournis par ESPN, gardés en cache 7 jours) ---------- */
const LOGO_SRC = { PL: "soccer/eng.1", LIGA: "soccer/esp.1", SA: "soccer/ita.1", BL: "soccer/ger.1", L1: "soccer/fra.1", NHL: "hockey/nhl" };
let teamLists = {};
try { const c = JSON.parse(localStorage.getItem("pl_logos") || "null"); if (c && Date.now() - c.at < 7 * 864e5) teamLists = c.lists; } catch (e) {}
async function loadLogos() {
  const need = Object.keys(LOGO_SRC).filter(k => !teamLists[k]);
  if (!need.length) return;
  await Promise.all(need.map(async k => {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${LOGO_SRC[k]}/teams`); if (!r.ok) return;
      const j = await r.json();
      const teams = (((j.sports || [])[0] || {}).leagues || [{}])[0].teams || [];
      teamLists[k] = teams.map(t => t.team).filter(t => t && t.logos && t.logos[0]).map(t => ({
        displayName: t.displayName, shortDisplayName: t.shortDisplayName, name: t.name, location: t.location, abbreviation: t.abbreviation, logo: t.logos[0].href }));
    } catch (e) {}
  }));
  try { localStorage.setItem("pl_logos", JSON.stringify({ at: Date.now(), lists: teamLists })); } catch (e) {}
  logoCache.clear();
  if (matches.length) render(); if (view === "match") renderDetail(); if (view === "combos") renderCombos();
}
const logoCache = new Map();
function logoOf(league, name) {
  const key = league + "|" + name; if (logoCache.has(key)) return logoCache.get(key);
  let best = null, bs = 1;
  for (const t of teamLists[league] || []) { const sc = sim(name, t); if (sc > bs) { bs = sc; best = t.logo; } }
  logoCache.set(key, best); return best;
}
const logoImg = (m, t, cls = "tlogo") => { const u = logoOf(m.league, t.name);
  return u ? `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : `<span class="${cls} ini">${esc(t.name.replace(/^(FC|AS|SC|RC|AC|1\.)\s+/i, "").slice(0, 1).toUpperCase())}</span>`; };

function card(m) {
  const r = m.r, h = m.home, a = m.away, res = resultOf(m), st = res && res.state;
  let right = `<span class="badge c-${r.cls}"><b>${r.pick}</b><small>${CL[r.cls]} ${pc(r.conf)} %</small></span>`;
  let left = `${hFmt.format(m.date)}<small>${LGS[m.league] || ""}</small>`;
  if (st === "in") {
    right = `<span class="badge c-live"><b>${res.hs} – ${res.as}</b><small>Prono ${r.pick}</small></span>`;
    left = `<span class="lmin on"><span class="pulse"></span>${esc(res.clock)}</span><small>En direct</small>`;
  } else if (st === "post") {
    const w = wins(r.pick, res.hs, res.as, res.ot);
    right = `<span class="badge ${w ? "c-won" : "c-lost"}"><b>${r.pick} ${w ? "✓" : "✗"}</b><small>${res.hs} – ${res.as}</small></span>`;
    left = `Fin<small>${LGS[m.league] || ""}</small>`;
  }
  return `<div class="m"><button data-id="${esc(m.id)}">
    <span class="time">${left}</span>
    <span class="vs"><span class="row ${r.p1 > r.p2 ? "fav" : ""}">${logoImg(m, h)}<span class="tn">${esc(h.name)}</span>${formHtml(h.form)}</span>
      <span class="row ${r.p2 > r.p1 ? "fav" : ""}">${logoImg(m, a)}<span class="tn">${esc(a.name)}</span>${formHtml(a.form)}</span></span>
    <span class="p3"><span class="b"><i style="flex:${r.p1};background:var(--home)"></i><i style="flex:${r.px};background:var(--draw)"></i><i style="flex:${r.p2};background:var(--away)"></i></span>
      <span class="n"><span>1 · ${pc(r.p1)}</span><span>N · ${pc(r.px)}</span><span>2 · ${pc(r.p2)}</span></span></span>
    ${right}
  </button></div>`;
}
const LGMETA = { NHL: ["USA", "Amérique du Nord", "#2b2b2b"], KHL: ["RUS", "Russie", "#b23a48"], SHL: ["SWE", "Suède", "#2f6db5"], LIIGA: ["FIN", "Finlande", "#3f7cc7"], NL: ["SUI", "Suisse", "#c8102e"], DEL: ["GER", "Allemagne", "#d9534f"], PL: ["ENG", "Angleterre", "#6a4fb3"], LIGA: ["ESP", "Espagne", "#e0873a"], SA: ["ITA", "Italie", "#3a7bd5"], BL: ["GER", "Allemagne", "#d9534f"], L1: ["FRA", "France", "#2c4a7a"] };
const FOOT_ORDER = ["PL", "LIGA", "SA", "BL", "L1"], HOCKEY_ORDER = ["NHL", "KHL", "SHL", "LIIGA", "NL", "DEL"];
let sport = "foot"; try { if (localStorage.getItem("pl_sport") === "hockey") sport = "hockey"; } catch (e) {}
const allData = { foot: [], hockey: [] }, dataMeta = { foot: null, hockey: null };
const lgOrder = () => sport === "hockey" ? HOCKEY_ORDER : FOOT_ORDER;
const dayKey = d => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
let selDay = null;
function lgHead(k, extra = "") {
  const m = LGMETA[k] || ["", "", "#888"];
  return `<div class="lghead"><span class="flag" style="background:${m[2]}">${m[0]}</span><div><b>${LG[k] || k}</b><br><span>${m[1]}${extra}</span></div></div>`;
}
// Accès au programme : sans abonnement, le jour même ; avec abonnement, jusqu'à 3 jours. Les jours passés restent visibles (résultats).
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayDiff = d => Math.round((dayStart(d) - dayStart(new Date())) / 864e5);
const maxDays = () => isMember() ? 3 : 1;
const canSee = m => dayDiff(m.date) < maxDays();
const inWindow = m => dayDiff(m.date) < 3;
function renderDays() {
  const vis = matches.filter(inWindow);
  const keys = [...new Set(vis.map(m => dayKey(m.date)))].sort((a, b) => new Date(a.replace(/-/g, "/")) - new Date(b.replace(/-/g, "/")));
  if (!selDay || !keys.includes(selDay)) {
    const today = dayKey(new Date());
    const nextOk = vis.filter(m => canSee(m) && dayDiff(m.date) >= 0).sort((x, y) => x.date - y.date)[0];
    selDay = keys.includes(today) ? today : nextOk ? dayKey(nextOk.date) : (keys.find(k => dayDiff(vis.find(m => dayKey(m.date) === k).date) >= 0) || keys[keys.length - 1]);
  }
  const wd = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
  $("days").innerHTML = keys.map(k => { const d = vis.find(m => dayKey(m.date) === k).date, dd = dayDiff(d), locked = dd >= maxDays();
    const lab = dd === 0 ? "Auj." : dd === 1 ? "Dem." : wd.format(d).replace(".", "");
    return `<button role="tab" data-day="${k}" aria-selected="${k === selDay}" class="${locked ? "lockd" : ""}"><small>${lab}</small><b>${d.getDate()}</b>${locked ? '<i class="lk">🔒</i>' : ""}</button>`; }).join("");
}
function render() {
  if (!matches.length) return;
  const now = Date.now() - 2 * 3600e3;
  const up = matches.filter(m => m.date.getTime() > now && canSee(m));
  const pool = up.length ? up : matches;
  const top = [...pool].filter(m => m.r.pick.length === 1 && m.r.pick !== "N").sort((x, y) => y.r.conf - x.r.conf).slice(0, 5);
  $("topSec").hidden = !top.length;
  const lock = !isMember(); $("topSec").classList.toggle("locked", lock);
  let ov = $("lockov");
  if (lock && !ov) {
    ov = document.createElement("div"); ov.id = "lockov"; ov.className = "lockover";
    ov.innerHTML = `<div><b>Les 5 coups sûrs</b><span class="msg">Réservés aux membres · dès ${cfa(PLANS.week.price)} la semaine</span><button class="cta" data-join>Devenir membre</button></div>`;
    $("topSec").appendChild(ov);
  }
  if (!lock && ov) ov.remove();
  $("picks").innerHTML = top.map(m => `<button class="pick" data-id="${esc(m.id)}"><span class="lg">${LG[m.league]} · ${dayFmt.format(m.date).split(" ")[0]} ${hFmt.format(m.date)}</span>
    <span class="teams"><span class="pt">${logoImg(m, m.home, "pl2")}${esc(m.home.name)}</span><span class="pt">${logoImg(m, m.away, "pl2")}${esc(m.away.name)}</span></span>
    <span class="bet"><b>${esc(m.r.pickLabel)}</b><span>${pc(m.r.conf)}%</span></span></button>`).join("");
  renderDays();
  let w = 0, l = 0; matches.forEach(m => { const x = resultOf(m); if (x && x.state === "post") (wins(m.r.pick, x.hs, x.as, x.ot) ? w++ : l++); });
  $("bilan").hidden = !(w + l);
  $("bilan").innerHTML = `<span class="lab">Bilan de la période</span><div class="bil"><span class="res won">✓ ${w} gagné${w > 1 ? "s" : ""}</span><span class="res lost">✗ ${l} perdu${l > 1 ? "s" : ""}</span><b>${w + l ? Math.round(100 * w / (w + l)) : 0} % de réussite</b></div>`;
  const list = matches.filter(m => (filter === "ALL" || m.league === filter) && (sort === "conf" ? canSee(m) && dayDiff(m.date) >= 0 : dayKey(m.date) === selDay));
  $("days").hidden = sort === "conf";
  if (sort !== "conf" && list.length && !canSee(list[0])) {
    const d = list[0].date;
    $("list").innerHTML = `<div class="combolock"><div class="blurred"><div></div><div></div><div></div></div>
      <h2>${list.length} match${list.length > 1 ? "s" : ""} au programme ${dayDiff(d) === 1 ? "demain" : "le " + esc(dayFmt.format(d))}</h2>
      <p class="msg">Sans abonnement, tu vois le programme du jour. Les membres ont les pronos jusqu'à 3 jours à l'avance, les coupons du jour et l'accès au canal Telegram privé.</p>
      <button class="cta" data-join>Devenir membre</button></div>`;
    return;
  }
  if (!list.length) { $("list").innerHTML = '<div class="empty">Aucun match pour ce filtre.</div>'; return; }
  if (sort === "conf") {
    list.sort((x, y) => y.r.conf - x.r.conf);
    $("list").innerHTML = '<div class="lgcard">' + list.map(card).join("") + "</div>";
    return;
  }
  list.sort((x, y) => x.date - y.date);
  $("list").innerHTML = '<div class="day">' + lgOrder().filter(k => list.some(m => m.league === k)).map(k =>
    `<div class="lgcard">${lgHead(k)}${list.filter(m => m.league === k).map(card).join("")}</div>`).join("") + "</div>";
}
function chips() {
  const present = new Set(matches.map(m => m.league));
  $("lgChips").innerHTML = Object.keys(LG).filter(k => k === "ALL" || present.has(k)).map(k => `<button class="chip" data-lg="${k}" aria-pressed="${k === filter}">${LG[k]}</button>`).join("");
}
async function loadFile(kind) {
  const res = await fetch(`data/${kind === "hockey" ? "hockey" : "matches"}.json?t=` + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(res.status);
  const x = await res.json();
  allData[kind] = (x.matches || []).map(m => { const o = { ...m, sport: kind === "hockey" ? "hockey" : "foot", date: new Date(m.kickoff) }; o.r = analyseAny(o); return o; });
  dataMeta[kind] = x;
}
function applySport() {
  matches = allData[sport]; filter = "ALL"; selDay = null;
  document.querySelectorAll("[data-sport]").forEach(b => b.setAttribute("aria-pressed", b.dataset.sport === sport));
  const x = dataMeta[sport];
  $("upd").textContent = x ? (sport === "hockey" ? "Période du " : "Week-end du ") + (x.weekend || "") + " · mis à jour le " + new Date(x.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "";

  if (!matches.length) {
    $("list").innerHTML = `<div class="empty">${sport === "hockey" ? "Aucun match de hockey programmé pour le moment. Le programme est actualisé chaque matin." : "Aucun match programmé pour le moment. Le programme est actualisé chaque semaine."}</div>`;
    $("topSec").hidden = true; $("bilan").hidden = true; $("days").innerHTML = ""; $("lgChips").innerHTML = "";
  } else { chips(); render(); }
  renderCombos(); if (view === "live") renderLive(); resultsLoop();
}
async function loadMatches() {
  const r = await Promise.allSettled([loadFile("foot"), loadFile("hockey")]);
  if (r[0].status === "rejected" && r[1].status === "rejected") {
    $("list").innerHTML = '<div class="empty">Les matchs n\'ont pas pu être chargés. Vérifie ta connexion internet puis rouvre l\'app.</div>'; return;
  }
  applySport(); if (view === "match") renderDetail();
  loadLogos();
}

/* ---------- Compte ---------- */
function renderTop() {
  const b = $("accBtn");
  if (!fs) { b.hidden = true; return; }
  b.hidden = false;
  b.textContent = me ? ((myAcc && myAcc.name) || "Mon compte") : "Se connecter";
}
function renderWelcome() {
  const show = !!fs && (asVisitor ? !skipped : (!me && !skipped) || (me && accLoaded && !myAcc && !isOwner));
  $("welcome").hidden = !show;
  if (!show) return;
  const needProfile = me && !asVisitor && !myAcc;
  $("tabs").hidden = !!needProfile;
  $("tabCreate").setAttribute("aria-selected", authTab === "create");
  $("tabLogin").setAttribute("aria-selected", authTab === "login");
  const create = authTab === "create" || needProfile;
  document.querySelectorAll("[data-create]").forEach(el => el.hidden = !create);
  $("aPass").hidden = !!needProfile; $("aPassLab").hidden = !!needProfile;
  $("aPhone").parentElement.hidden = !!needProfile;
  $("accSubmit").textContent = needProfile ? "Terminer mon profil" : create ? "Créer mon compte" : "Me connecter";
  $("welcomeTitle").textContent = create ? "Bienvenue sur Prono Lab" : "Content de te revoir";
  $("welcomeText").textContent = needProfile ? "Il manque juste ton prénom pour terminer ton compte." :
    create ? "Crée ton compte en quelques secondes pour suivre les pronos chaque week-end et t'abonner aux coups sûrs." :
    "Connecte-toi avec ton numéro de téléphone et ton mot de passe.";
  $("forgot").hidden = create;
}
/* ---------- Programme de fidélité ---------- */
const LOYAL = { week: 100, month: 450, referral: 200, reward: 500, rewardDays: 7 };
const LEVELS = [["Bronze", 0, 1, "#c98a5a"], ["Argent", 1000, 1.1, "#8e9aa6"], ["Or", 3000, 1.25, "#d9a520"]];
const levelOf = life => { let l = LEVELS[0]; LEVELS.forEach(x => { if ((life || 0) >= x[1]) l = x; }); return l; };
const nextLevel = life => LEVELS.find(x => x[1] > (life || 0));

function subscribeHtml(req, title, sub) {
  const nums = PAYS.filter(([k]) => payment[k]);
  const pending = req && req.status === "pending" && req.type !== "redeem";
  const save = PLANS.week.price * 4 - PLANS.month.price;
  return `<div class="clubhead"><div><h2>${title}</h2><p class="msg">${sub}</p></div>
      <div class="price">dès ${PLANS.week.price} <small>F CFA / semaine</small></div></div>
    <ul class="perks"><li>Pronos jusqu'à 3 jours à l'avance</li><li>Coups sûrs et coupons du jour</li><li>Analyse complète de chaque match</li><li>Canal Telegram privé des membres</li></ul>
    ${pending ? `<p class="msg ok">Demande ${esc((PLANS[req.plan] || PLANS.week).label.toLowerCase())} envoyée le ${esc(dFmt(req.at))} (référence ${esc(req.ref)}). Ton accès sera activé dès que le paiement sera vérifié.</p>` : ""}
    ${req && req.status === "refused" ? `<p class="msg err">Ta dernière demande n'a pas pu être validée : le paiement n'a pas été retrouvé. Vérifie la référence et renvoie une demande.</p>` : ""}
    <div class="steps">
      <div class="step"><b>1 · Choisis ta formule</b>
        <div class="plans" role="radiogroup" aria-label="Formule">
          <label class="plan" for="pWeek"><input type="radio" name="plan" id="pWeek" value="week" ${selPlan === "week" ? "checked" : ""}><span>${PLANS.week.label} · ${PLANS.week.days} jours</span><b>${cfa(PLANS.week.price)}</b><em class="pts">+${LOYAL.week} pts</em></label>
          <label class="plan" for="pMonth"><input type="radio" name="plan" id="pMonth" value="month" ${selPlan === "month" ? "checked" : ""}><span>${PLANS.month.label} · ${PLANS.month.days} jours</span><b>${cfa(PLANS.month.price)}</b>${save > 0 ? `<em>${save.toLocaleString("fr-FR")} F d'économie</em>` : ""}<em class="pts">+${LOYAL.month} pts</em></label>
        </div>
        <b>2 · Envoie le montant</b>
        ${nums.length ? nums.map(([k, l]) => `<div class="pay"><span>${l}</span><code>${esc(payment[k])}</code><button class="mini" data-copy="${esc(payment[k])}">Copier</button></div>`).join("") : `<p class="msg">Pour payer, contacte l'assistance WhatsApp dans l'onglet Aide.</p>`}
      </div>
      <div class="step"><b>3 · Confirme ton paiement</b>
        <form id="joinForm">
          <label for="jMethod">Moyen de paiement<select id="jMethod">${PAYS.map(([k, l]) => `<option value="${k}" ${req && req.method === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label for="jPhone">Numéro qui a payé<input id="jPhone" inputmode="tel" required placeholder="ex. 70 00 00 00" value="${esc((req && req.phone) || (myAcc && myAcc.phone) || "")}"></label>
          <label for="jRef">Référence de la transaction<input id="jRef" required placeholder="reçue par SMS"></label>
          <button class="cta" type="submit">${pending ? "Renvoyer ma demande" : "Envoyer ma demande"}</button>
          <p class="msg" id="joinMsg"></p>
        </form></div>
    </div>`;
}
let showRenew = false, showSettings = false;
function renderClub() {
  const c = $("club"); c.hidden = false;
  if (!fs) { c.className = "club"; c.innerHTML = `<h2>Espace membre</h2><p class="msg">L'espace membre est momentanément indisponible. Vérifie ta connexion puis rouvre l'application.</p>`; return; }
  if (owner()) {
    c.className = "acct";
    c.innerHTML = `<div class="club on"><h2>Espace administrateur</h2><p class="msg">Tu vois tout le contenu débloqué. Les demandes d'abonnement et d'échange de points s'affichent plus bas, dans « Gestion des membres ».</p>
      <div class="rowbtns"><button class="mini" id="logoutBtn">Se déconnecter</button></div></div>`;
    return;
  }
  if (!me || !myAcc) {
    c.className = "club";
    c.innerHTML = `<div class="clubhead"><div><h2>Deviens membre</h2><p class="msg">Crée ton compte ou connecte-toi, puis choisis ta formule : ${cfa(PLANS.week.price)} la semaine ou ${cfa(PLANS.month.price)} le mois. Chaque abonnement te rapporte des points fidélité.</p></div><button class="cta" id="openAcc">${me ? "Terminer mon compte" : "Créer mon compte"}</button></div>`;
    return;
  }
  const mem = myMember || {}, req = myReq, active = isMember();
  const left = active ? Math.max(0, Math.ceil((new Date(mem.until) - Date.now()) / 864e5)) : 0;
  const span = (PLANS[mem.plan] || PLANS.week).days;
  const pts = mem.points || 0, life = mem.lifetime || 0, lv = levelOf(life), nx = nextLevel(life);
  const initials = myAcc.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const redeemPending = req && req.status === "pending" && req.type === "redeem";
  const hist = (mem.history || []).slice().reverse().slice(0, 8);
  const refCode = digits(myAcc.phone).slice(-8);
  const wa = "https://wa.me/?text=" + encodeURIComponent(`Je suis les pronos foot sur Prono Lab. Inscris-toi avec mon code parrain ${refCode} : ${location.origin + location.pathname}?ref=${refCode}`);
  c.className = "acct";
  c.innerHTML = `
    <div class="profile">
      <span class="avatar">${esc(initials)}</span>
      <div class="pinfo"><b>${esc(myAcc.name)}</b><span>${esc(myAcc.phone)}${myAcc.city ? " · " + esc(myAcc.city) : ""}</span></div>
      <span class="lvl" style="--lv:${lv[3]}">${lv[0]}</span>
    </div>

    <div class="club ${active ? "on" : ""}">
      ${active ? `<div class="clubhead"><div><h2>Abonnement actif</h2><p class="msg">Formule ${esc((PLANS[mem.plan] || PLANS.week).label)} · jusqu'au ${esc(dFmt(mem.until))}</p></div>
        <div class="price">${left}<small> jour${left > 1 ? "s" : ""}</small></div></div>
        <div class="meter"><i style="width:${Math.min(100, 100 * left / span)}%"></i></div>
        ${left <= 2 ? `<p class="msg err">Ton abonnement se termine bientôt : prolonge-le pour ne rater aucun coupon.</p>` : ""}
        ${payment.telegram ? `<a class="cta tg" href="${esc(payment.telegram)}" target="_blank" rel="noopener">Rejoindre le canal Telegram des membres</a>` : `<p class="msg">Le lien du canal Telegram t'est communiqué par l'assistance WhatsApp.</p>`}
        ${showRenew ? subscribeHtml(req, "Prolonger", "Les jours achetés s'ajoutent à ceux qui restent.") : `<button class="cta" id="renewBtn">Prolonger mon abonnement</button>`}`
      : subscribeHtml(req, mem.until ? "Ton abonnement a expiré" : "Deviens membre", "Débloque les pronos sur 3 jours, les coups sûrs, les coupons du jour, l'analyse complète de chaque match et le canal Telegram privé.")}
    </div>

    <div class="loyal">
      <div class="clubhead"><div><h2>Programme fidélité</h2><p class="msg">Niveau ${lv[0]}${lv[2] > 1 ? ` · points ×${String(lv[2]).replace(".", ",")}` : ""}${nx ? ` · encore ${(nx[1] - life).toLocaleString("fr-FR")} pts pour le niveau ${nx[0]}` : " · niveau maximum"}</p></div>
        <div class="price">${pts.toLocaleString("fr-FR")}<small> pts</small></div></div>
      <div class="meter gold"><i style="width:${Math.min(100, 100 * pts / LOYAL.reward)}%"></i></div>
      <p class="msg">${pts >= LOYAL.reward ? "Tu peux échanger tes points contre une semaine offerte." : `Encore ${(LOYAL.reward - pts).toLocaleString("fr-FR")} pts pour une semaine offerte.`}</p>
      <button class="cta" id="redeemBtn" ${pts < LOYAL.reward || redeemPending ? "disabled" : ""}>${redeemPending ? "Échange en cours de validation" : `Échanger ${LOYAL.reward} pts contre ${LOYAL.rewardDays} jours offerts`}</button>
      <div class="earn">
        <div><b>+${LOYAL.week}</b><span>abonnement Hebdo</span></div>
        <div><b>+${LOYAL.month}</b><span>abonnement Mensuel</span></div>
        <div><b>+${LOYAL.referral}</b><span>par ami parrainé</span></div>
      </div>
      <div class="ref">
        <span class="lab">Ton code parrain</span>
        <div class="pay"><code>${esc(refCode)}</code><button class="mini" data-copy="${esc(refCode)}">Copier</button></div>
        <a class="cta wa" href="${wa}" target="_blank" rel="noopener">Inviter un ami sur WhatsApp</a>
        <span class="msg">Ton ami saisit ce code à l'inscription. Dès son premier abonnement, tu gagnes ${LOYAL.referral} pts.${mem.referrals ? ` Déjà ${mem.referrals} ami${mem.referrals > 1 ? "s" : ""} parrainé${mem.referrals > 1 ? "s" : ""}.` : ""}</span>
      </div>
      <details class="lvls"><summary>Les niveaux</summary>
        ${LEVELS.map(l => `<div class="kv"><span><span class="lvl" style="--lv:${l[3]}">${l[0]}</span></span><span>${l[1] ? "dès " + l[1].toLocaleString("fr-FR") + " pts cumulés" : "dès l'inscription"}${l[2] > 1 ? " · points ×" + String(l[2]).replace(".", ",") : ""}</span></div>`).join("")}
      </details>
    </div>

    ${hist.length ? `<div class="club"><h2>Historique</h2>${hist.map(x => `<div class="kv"><span>${esc(new Date(x.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))} · ${esc(x.label)}</span><span>${x.pts ? (x.pts > 0 ? "+" : "") + x.pts + " pts" : ""}</span></div>`).join("")}</div>` : ""}

    <div class="club">
      <button class="settog" id="setBtn" aria-expanded="${showSettings}"><h2>Paramètres</h2><span>${showSettings ? "–" : "+"}</span></button>
      ${showSettings ? `
      <form id="profForm"><span class="lab">Mon profil</span>
        <label for="pName">Prénom ou pseudo<input id="pName" maxlength="40" value="${esc(myAcc.name)}"></label>
        <label for="pCity">Ville<input id="pCity" maxlength="40" value="${esc(myAcc.city || "")}"></label>
        <button class="cta" type="submit">Enregistrer</button><p class="msg" id="profMsg"></p></form>
      <form id="pwForm"><span class="lab">Changer de mot de passe</span>
        <label for="pwOld">Mot de passe actuel<input id="pwOld" type="password" autocomplete="current-password"></label>
        <label for="pwNew">Nouveau mot de passe (6 caractères minimum)<input id="pwNew" type="password" minlength="6" autocomplete="new-password"></label>
        <button class="cta" type="submit">Changer le mot de passe</button><p class="msg" id="pwMsg"></p></form>
      <button class="mini" id="logoutBtn">Se déconnecter</button>` : ""}
    </div>`;
}
function renderAdmin() {
  if (!owner()) { $("admin").hidden = true; return; }
  $("admin").hidden = false;
  const n = Object.keys(accounts).length, nm = Object.values(members).filter(m => new Date(m.until) > new Date()).length;
  $("accCount").textContent = `${n} compte${n > 1 ? "s" : ""} · ${nm} membre${nm > 1 ? "s" : ""} actif${nm > 1 ? "s" : ""}`;
  const pend = reqs.filter(r => r.status === "pending").sort((a, b) => String(a.at).localeCompare(String(b.at)));
  $("reqs").innerHTML = pend.length ? pend.map(r => {
    const m = members[r.id], act = m && new Date(m.until) > new Date(), pl = PLANS[r.plan] || PLANS.week, acc = accounts[r.id];
    if (r.type === "redeem") return `<div class="req"><div class="who"><b>${acc ? esc(acc.name) : "Client"} · échange de points</b>
      <span>${(m && m.points) || 0} pts disponibles · demande ${LOYAL.rewardDays} jours offerts contre ${LOYAL.reward} pts</span>
      <span>Envoyée le ${esc(new Date(r.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span></div>
      <div class="act"><button class="cta alt" data-ok="${esc(r.id)}">Offrir ${LOYAL.rewardDays} jours</button><button class="mini" data-no="${esc(r.id)}">Refuser</button></div></div>`;
    const ref = acc && acc.referredBy ? Object.values(accounts).find(x => digits(x.phone).endsWith(acc.referredBy)) : null;
    return `<div class="req"><div class="who"><b>${acc ? esc(acc.name) : "Client"}</b>
      <span>${pl.label} · ${cfa(pl.price)} · ${esc((PAYS.find(p => p[0] === r.method) || [, r.method])[1])} · ${esc(r.phone)} · réf. ${esc(r.ref)}</span>
      ${acc ? `<span>Compte : ${esc(acc.phone)}${acc.city ? " · " + esc(acc.city) : ""}</span>` : ""}
      ${ref && !(m && m.paid) ? `<span>Parrainé par ${esc(ref.name)} (+${LOYAL.referral} pts pour lui à la validation)</span>` : ""}
      <span>Envoyée le ${esc(new Date(r.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}${act ? " · déjà membre jusqu'au " + esc(dFmt(m.until)) : ""}</span></div>
      <div class="act"><button class="cta alt" data-ok="${esc(r.id)}">Valider ${pl.days} jours</button><button class="mini" data-no="${esc(r.id)}">Refuser</button></div></div>`;
  }).join("") : '<p class="msg">Aucune demande pour le moment.</p>';
  const act = Object.entries(members).filter(([, m]) => m.until && new Date(m.until) > new Date()).sort((a, b) => a[1].until.localeCompare(b[1].until));
  const exp = Object.entries(members).filter(([, m]) => m.until && new Date(m.until) <= new Date() && Date.now() - new Date(m.until) < 30 * 864e5);
  $("expd").innerHTML = exp.length ? exp.map(([id, m]) => `<div class="kv"><span>${esc((accounts[id] && accounts[id].name) || "Client")} · ${esc((accounts[id] && accounts[id].phone) || "")}</span><span>fini le ${esc(new Date(m.until).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</span></div>`).join("") : '<p class="msg">Aucun abonnement expiré ces 30 derniers jours.</p>';
  $("mems").innerHTML = act.length ? act.map(([id, m]) => `<div class="kv"><span>${esc((accounts[id] && accounts[id].name) || "Client")} · ${esc((accounts[id] && accounts[id].phone) || "")}</span><span>jusqu'au ${esc(new Date(m.until).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</span></div>`).join("") : '<p class="msg">Aucun membre actif.</p>';
}
function renderAll() { renderTop(); renderWelcome(); renderClub(); renderAdmin(); render(); renderCombos(); }

/* ---------- Firebase ---------- */
function stopListeners(list) { list.forEach(u => { try { u(); } catch (e) {} }); list.length = 0; }
function initFirebase() {
  if (!CFG.firebase || !window.firebase) { renderAll(); return; }
  fb = firebase.initializeApp(CFG.firebase); auth = firebase.auth(); fs = firebase.firestore();
  fs.collection("meta").doc("payment").onSnapshot(d => { payment = d.exists ? d.data() : {};
    if (isOwner) { $("nOrange").value = payment.orange || ""; $("nMoov").value = payment.moov || ""; $("nWave").value = payment.wave || ""; $("nTelegram").value = payment.telegram || ""; }
    renderClub(); }, () => {});
  auth.onAuthStateChanged(u => {
    stopListeners(unsubs); stopListeners(adminUnsubs);
    me = u; myAcc = null; myMember = null; myReq = null; accLoaded = false; asVisitor = false;
    isOwner = !!u && u.email === normPhone(CFG.adminPhone) + "@pronolab.app";
    if (u) {
      unsubs.push(fs.collection("accounts").doc(u.uid).onSnapshot(d => { myAcc = d.exists ? d.data() : null; accLoaded = true; renderAll(); }, () => { accLoaded = true; renderAll(); }));
      unsubs.push(fs.collection("members").doc(u.uid).onSnapshot(d => { myMember = d.exists ? d.data() : null; renderAll(); }, () => {}));
      unsubs.push(fs.collection("requests").doc(u.uid).onSnapshot(d => { myReq = d.exists ? d.data() : null; renderClub(); }, () => {}));
      if (isOwner) {
        adminUnsubs.push(fs.collection("requests").onSnapshot(s => { reqs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAdmin(); }, () => {}));
        adminUnsubs.push(fs.collection("accounts").onSnapshot(s => { accounts = {}; s.docs.forEach(d => accounts[d.id] = d.data()); renderAdmin(); }, () => {}));
        adminUnsubs.push(fs.collection("members").onSnapshot(s => { members = {}; s.docs.forEach(d => members[d.id] = d.data()); renderAdmin(); }, () => {}));
        $("nOrange").value = payment.orange || ""; $("nMoov").value = payment.moov || ""; $("nWave").value = payment.wave || ""; $("nTelegram").value = payment.telegram || "";
      }
    }
    renderAll();
  });
}
const AUTH_ERR = {
  "auth/email-already-in-use": "Ce numéro a déjà un compte. Touche « Se connecter ».",
  "auth/invalid-credential": "Numéro ou mot de passe incorrect.",
  "auth/wrong-password": "Numéro ou mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec ce numéro. Touche « Créer un compte ».",
  "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
  "auth/too-many-requests": "Trop d'essais. Patiente quelques minutes puis réessaie.",
  "auth/network-request-failed": "Pas de connexion internet. Vérifie ton réseau et réessaie.",
  "auth/invalid-email": "Ce numéro de téléphone n'est pas valide.",
  "unavailable": "Le service ne répond pas. Vérifie ta connexion et réessaie."
};

/* ---------- Événements ---------- */
document.addEventListener("click", async e => {
  const t = e.target;
  const c = t.closest("[data-lg]"); if (c) { filter = c.dataset.lg; chips(); render(); return; }
  const sw = t.closest("[data-sport]"); if (sw) { sport = sw.dataset.sport; try { localStorage.setItem("pl_sport", sport); } catch (err) {} applySport(); if (view === "match" || view === "lv") go("matchs"); return; }
  const gb = t.closest("[data-go]"); if (gb) { go(gb.dataset.go); return; }
  if (t.closest("[data-join]")) { go("compte"); setTimeout(() => $("club").scrollIntoView({ behavior: "smooth", block: "start" }), 50); return; }
  const dy = t.closest("[data-day]"); if (dy) { selDay = dy.dataset.day; render(); return; }
  const lvb = t.closest("[data-lv]"); if (lvb) { go("lv-" + lvb.dataset.lv); return; }
  const cc = t.closest("[data-ticket]"); if (cc) { const txt = ticketText(cc.dataset.ticket); try { await navigator.clipboard.writeText(txt); cc.textContent = "Ticket copié"; } catch (err) { cc.textContent = "Copie impossible"; } return; }
  if (t.closest("#logoutBtn")) { await auth.signOut(); skipped = false; showSettings = false; showRenew = false; return; }
  if (t.closest("#renewBtn")) { showRenew = true; renderClub(); return; }
  if (t.closest("#setBtn")) { showSettings = !showSettings; renderClub(); return; }
  if (t.closest("#redeemBtn")) { const b2 = t.closest("#redeemBtn"); b2.disabled = true;
    try { await fs.collection("requests").doc(me.uid).set({ type: "redeem", plan: "reward", at: new Date().toISOString(), status: "pending" }); }
    catch (err) { b2.disabled = false; b2.textContent = "Échec, réessaie"; } return; }
  if (t.closest("#tabCreate")) { authTab = "create"; renderWelcome(); return; }
  if (t.closest("#tabLogin")) { authTab = "login"; renderWelcome(); return; }
  if (t.closest("#accBtn")) { if (!me) { skipped = false; authTab = "login"; renderWelcome(); } go("compte"); return; }
  if (t.closest("#openAcc")) { skipped = false; try { localStorage.removeItem("pl_skip"); } catch (err) {} authTab = "create"; renderWelcome(); go("compte"); return; }
  if (t.closest("#skipBtn")) { skipped = true; if (!asVisitor) { try { localStorage.setItem("pl_skip", "1"); } catch (err) {} } renderWelcome(); return; }

  const cp = t.closest("[data-copy]"); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = "Copié"; } catch (err) {} return; }
  const ok = t.closest("[data-ok]"); if (ok) { validate(ok.dataset.ok, ok); return; }
  const no = t.closest("[data-no]"); if (no) { no.disabled = true; try { await fs.collection("requests").doc(no.dataset.no).update({ status: "refused" }); } catch (err) { no.disabled = false; } return; }
  if (t.closest("[data-cgu]")) { showCgu(true); return; }
  const op = t.closest("[data-open]"); if (op) { go("match-" + op.dataset.open); return; }
  if (t.closest("[data-back]")) { if (history.length > 1 && (location.hash.startsWith("#match-") || location.hash.startsWith("#lv-"))) history.back(); else go(prevView); return; }
  const cd = t.closest("[data-cday]"); if (cd) { comboDay = +cd.dataset.cday; renderCombos(); return; }
  const p = t.closest(".pick"); if (p) { go("match-" + p.dataset.id); return; }
  const b = t.closest(".m>button"); if (b) { go("match-" + b.dataset.id); }
});
document.addEventListener("change", e => { if (e.target.name === "plan") selPlan = e.target.value; });
document.addEventListener("submit", async e => {
  e.preventDefault();
  if (e.target.id === "accForm") {
    const msg = $("accMsg"), btn = $("accSubmit");
    const name = $("aName").value.trim(), phone = $("aPhone").value.trim(), city = $("aCity").value.trim(), pass = $("aPass").value;
    const refBy = digits($("aRef").value).slice(-8);
    const needProfile = me && !asVisitor && !myAcc, create = authTab === "create" || needProfile;
    if (create && !name) { msg.className = "msg err"; msg.textContent = "Indique ton prénom ou un pseudo."; return; }
    if (!needProfile && digits(phone).length < 8) { msg.className = "msg err"; msg.textContent = "Indique un numéro de téléphone complet."; return; }
    if (!needProfile && pass.length < 6) { msg.className = "msg err"; msg.textContent = "Le mot de passe doit contenir au moins 6 caractères."; return; }
    btn.disabled = true; msg.className = "msg"; msg.textContent = create ? "Création du compte…" : "Connexion…";
    try {
      if (needProfile) await fs.collection("accounts").doc(me.uid).set({ name, phone: me.email.split("@")[0], city, createdAt: new Date().toISOString() });
      else if (create) {
        const cred = await auth.createUserWithEmailAndPassword(phoneEmail(phone), pass);
        const acc = { name, phone: "+" + normPhone(phone), city, createdAt: new Date().toISOString(), cgu: CGU_VERSION, cguAt: cguAcceptedAt() };
        if (refBy.length === 8 && refBy !== digits(phone).slice(-8)) acc.referredBy = refBy;
        await fs.collection("accounts").doc(cred.user.uid).set(acc);
      } else await auth.signInWithEmailAndPassword(phoneEmail(phone), pass);
      msg.textContent = ""; e.target.reset();
    } catch (err) { msg.className = "msg err"; msg.textContent = AUTH_ERR[err.code] || "Une erreur est survenue. Vérifie ta connexion et réessaie."; }
    btn.disabled = false; return;
  }
  if (e.target.id === "joinForm") {
    const msg = $("joinMsg"), btn = e.target.querySelector("button");
    const ref = $("jRef").value.trim(), phone = $("jPhone").value.trim();
    if (!ref || !phone) { msg.className = "msg err"; msg.textContent = "Indique le numéro qui a payé et la référence reçue par SMS."; return; }
    const plan = (document.querySelector('input[name="plan"]:checked') || {}).value || "week";
    btn.disabled = true; msg.className = "msg"; msg.textContent = "Envoi…";
    try {
      await fs.collection("requests").doc(me.uid).set({ plan, amount: PLANS[plan].price, method: $("jMethod").value, phone, ref, at: new Date().toISOString(), status: "pending" });
      msg.className = "msg ok"; msg.textContent = "Demande envoyée. Ton accès sera activé après vérification du paiement.";
    } catch (err) { btn.disabled = false; msg.className = "msg err"; msg.textContent = "La demande n'est pas partie. Vérifie ta connexion et réessaie."; }
    return;
  }
  if (e.target.id === "profForm") {
    const msg = $("profMsg"), name = $("pName").value.trim();
    if (!name) { msg.className = "msg err"; msg.textContent = "Indique ton prénom ou un pseudo."; return; }
    try { await fs.collection("accounts").doc(me.uid).update({ name, city: $("pCity").value.trim() }); msg.className = "msg ok"; msg.textContent = "Profil enregistré."; }
    catch (err) { msg.className = "msg err"; msg.textContent = "Enregistrement impossible. Réessaie."; }
    return;
  }
  if (e.target.id === "pwForm") {
    const msg = $("pwMsg"), oldp = $("pwOld").value, newp = $("pwNew").value;
    if (newp.length < 6) { msg.className = "msg err"; msg.textContent = "Le nouveau mot de passe doit contenir au moins 6 caractères."; return; }
    try {
      await me.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(me.email, oldp));
      await me.updatePassword(newp); msg.className = "msg ok"; msg.textContent = "Mot de passe changé."; e.target.reset();
    } catch (err) { msg.className = "msg err"; msg.textContent = /wrong-password|invalid-credential/.test(err.code || "") ? "Le mot de passe actuel est incorrect." : "Changement impossible. Réessaie."; }
    return;
  }
  if (e.target.id === "payForm") {
    const msg = $("payMsg");
    const tg = $("nTelegram").value.trim();
    if (tg && !/^https:\/\/(t\.me|telegram\.me)\//.test(tg)) { msg.className = "msg err"; msg.textContent = "Le lien Telegram doit commencer par https://t.me/"; return; }
    try { await fs.collection("meta").doc("payment").set({ orange: $("nOrange").value.trim(), moov: $("nMoov").value.trim(), wave: $("nWave").value.trim(), telegram: tg }); msg.className = "msg ok"; msg.textContent = "Numéros enregistrés."; }
    catch (err) { msg.className = "msg err"; msg.textContent = "Enregistrement impossible. Réessaie."; }
  }
});
async function validate(id, btn) {
  btn.disabled = true;
  try {
    const FV = firebase.firestore.FieldValue, now = new Date().toISOString();
    const cur = members[id] || {}, r = reqs.find(x => x.id === id) || {};
    const base = cur.until && new Date(cur.until) > new Date() ? new Date(cur.until) : new Date();
    if (r.type === "redeem") {
      if ((cur.points || 0) < LOYAL.reward) { btn.textContent = "Points insuffisants"; return; }
      const until = new Date(base.getTime() + LOYAL.rewardDays * 864e5); until.setHours(23, 59, 0, 0);
      await fs.collection("members").doc(id).set({ until: until.toISOString(), plan: "week", points: FV.increment(-LOYAL.reward),
        history: FV.arrayUnion({ at: now, label: `${LOYAL.rewardDays} jours offerts`, pts: -LOYAL.reward }) }, { merge: true });
    } else {
      const plan = PLANS[r.plan] ? r.plan : "week", days = PLANS[plan].days;
      const until = new Date(base.getTime() + days * 864e5); until.setHours(23, 59, 0, 0);
      const pts = Math.round(LOYAL[plan] * levelOf(cur.lifetime)[2]);
      await fs.collection("members").doc(id).set({ until: until.toISOString(), since: cur.since || now, plan, paid: true,
        points: FV.increment(pts), lifetime: FV.increment(pts),
        history: FV.arrayUnion({ at: now, label: `Abonnement ${PLANS[plan].label} · ${cfa(PLANS[plan].price)}`, pts }) }, { merge: true });
      const acc = accounts[id];
      if (!cur.paid && acc && acc.referredBy) {
        const sp = Object.entries(accounts).find(([uid, x]) => uid !== id && digits(x.phone).endsWith(acc.referredBy));
        if (sp) await fs.collection("members").doc(sp[0]).set({ points: FV.increment(LOYAL.referral), lifetime: FV.increment(LOYAL.referral), referrals: FV.increment(1),
          history: FV.arrayUnion({ at: now, label: `Parrainage de ${acc.name}`, pts: LOYAL.referral }) }, { merge: true });
      }
    }
    await fs.collection("requests").doc(id).update({ status: "validated", validatedAt: now });
  } catch (err) { btn.disabled = false; btn.textContent = "Échec, réessayer"; console.error(err); }
}
$("sTime").onclick = () => { sort = "time"; $("sTime").setAttribute("aria-pressed", "true"); $("sConf").setAttribute("aria-pressed", "false"); render(); };
$("sConf").onclick = () => { sort = "conf"; $("sConf").setAttribute("aria-pressed", "true"); $("sTime").setAttribute("aria-pressed", "false"); render(); };
$("forgot").onclick = () => { $("accMsg").className = "msg"; $("accMsg").textContent = "Mot de passe oublié ? Écris à l'administrateur sur WhatsApp au +" + normPhone(CFG.adminPhone) + " pour le réinitialiser."; };

/* ---------- Navigation par onglets ---------- */
const VIEWS = ["matchs", "live", "combos", "compte", "aide", "match", "lv"];
let view = "matchs", detailId = null, prevView = "matchs";
function go(v, push = true) {
  v = v || "matchs";
  if (v.startsWith("match-")) { detailId = decodeURIComponent(v.slice(6)); if (view !== "match" && view !== "lv") prevView = view; v = "match"; }
  if (v.startsWith("lv-")) { lvKey = decodeURIComponent(v.slice(3)); if (view !== "match" && view !== "lv") prevView = view; v = "lv"; }
  if (!VIEWS.includes(v) || (v === "match" && !detailId) || (v === "lv" && !lvKey)) v = "matchs";
  view = v;
  document.querySelectorAll("[data-view]").forEach(el => el.hidden = el.dataset.view !== v);
  const tab = v === "match" || v === "lv" ? prevView : v;
  document.querySelectorAll(".tabbar [data-go]").forEach(b => { if (b.dataset.go === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  const h = v === "match" ? "#match-" + encodeURIComponent(detailId) : v === "lv" ? "#lv-" + encodeURIComponent(lvKey) : "#" + v;
  if (push && location.hash !== h) history.pushState(null, "", h);
  window.scrollTo(0, 0);
  if (v === "live") loadLive(true);
  if (v === "lv") { lvDetail = null; $("lvDetail").innerHTML = '<button class="back" data-back>‹ Retour</button><div class="empty">Chargement du match…</div>'; loadLv(); }
  if (v === "match") renderDetail();
  if (v === "combos") renderCombos();
}
window.addEventListener("popstate", () => go(location.hash.slice(1), false));

/* ---------- Résultats et scores en direct (ESPN) ---------- */
const ESPN = { PL: "eng.1", LIGA: "esp.1", SA: "ita.1", BL: "ger.1", L1: "fra.1" };
const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
const ymdUTC = d => d.toISOString().slice(0, 10).replace(/-/g, "");
const espnDay = {}; // "20261031" -> { at, ok, data: { PL: [events] } }
const ESPN_H = { NHL: "hockey/nhl" };
async function fetchDay(key, maxAge, sp = sport) {
  const ck = sp + ":" + key, c = espnDay[ck];
  if (c && Date.now() - c.at < maxAge) return c;
  const leagues = sp === "hockey" ? Object.keys(ESPN_H) : FOOT_ORDER;
  const res = await Promise.all(leagues.map(k => fetch(`https://site.api.espn.com/apis/site/v2/sports/${sp === "hockey" ? ESPN_H[k] : "soccer/" + ESPN[k]}/scoreboard?dates=${key}`, { cache: "no-store" })
    .then(r => r.ok ? r.json() : null).catch(() => null)));
  const data = {}; leagues.forEach((k, i) => data[k] = (res[i] && res[i].events) || []);
  const out = { at: Date.now(), ok: res.some(Boolean), data };
  if (out.ok || !c) espnDay[ck] = out;
  return espnDay[ck];
}
const prevKey = d => ymdUTC(new Date(d.getTime() - 864e5));
const deacc = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ALIAS = { "barcelone": "barcelona", "seville": "sevilla", "valence": "valencia", "la corogne": "deportivo", "naples": "napoli", "come": "como",
  "venise": "venezia", "as rome": "roma", "milan ac": "ac milan", "inter": "internazionale inter", "bayern munich": "bayern", "mayence": "mainz",
  "fribourg": "freiburg", "augsbourg": "augsburg", "werder breme": "bremen", "cologne": "koln cologne", "francfort": "frankfurt", "hambourg": "hamburg",
  "atl madrid": "atletico", "bologne": "bologna", "parme": "parma", "man city": "manchester city", "man united": "manchester united",
  "nottm forest": "nottingham", "paris sg": "paris saint germain psg", "celta vigo": "celta", "athletic bilbao": "athletic", "real sociedad": "sociedad",
  "racing santander": "racing", "rayo vallecano": "rayo", "le havre": "havre", "schalke 04": "schalke", "union berlin": "union", "rb leipzig": "leipzig",
  "hull city": "hull", "coventry": "coventry", "crystal palace": "palace", "aston villa": "villa", "atalanta": "atalanta", "juventus": "juventus",
  "lazio": "lazio", "lyon": "lyon", "monaco": "monaco", "marseille": "marseille", "paris fc": "paris fc", "le mans": "mans", "betis": "betis" };
function sim(fr, team) {
  const a = deacc(fr), key = ALIAS[a] || a;
  const t = deacc([team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation].join(" "));
  if (t.includes(key)) return 3;
  return key.split(" ").filter(w => w.length >= 3 && t.includes(w)).length;
}
function findEvent(m) {
  const sp = m.sport || "foot";
  const evs = [ymdUTC(m.date), prevKey(m.date)].flatMap(k => { const c = espnDay[sp + ":" + k]; return c ? c.data[m.league] || [] : []; });
  let best = null, bs = 1;
  for (const ev of evs) {
    if (Math.abs(new Date(ev.date) - m.date) > 6 * 3600e3) continue;
    const comp = ev.competitions && ev.competitions[0]; if (!comp) continue;
    const h = comp.competitors.find(x => x.homeAway === "home"), a = comp.competitors.find(x => x.homeAway === "away");
    if (!h || !a) continue;
    const sc = sim(m.home.name, h.team) + sim(m.away.name, a.team);
    if (sc > bs) { bs = sc; best = ev; }
  }
  return best;
}
function resultOf(m) { // { state: pre|in|post, hs, as, clock, ot, ev }
  if (m.result && m.result.hs != null) return { state: "post", hs: +m.result.hs, as: +m.result.as, ot: !!m.result.ot, clock: "", ev: null };
  const ev = findEvent(m); if (!ev) return null;
  const comp = ev.competitions[0], st = (ev.status && ev.status.type) || {};
  const h = comp.competitors.find(x => x.homeAway === "home"), a = comp.competitors.find(x => x.homeAway === "away");
  const ot = m.sport === "hockey" && ((ev.status.period || 0) > 3 || /OT|SO/.test(st.shortDetail || ""));
  return { state: st.state, hs: +h.score, as: +a.score, ot, clock: m.sport === "hockey" ? hkClock(ev) : (ev.status.displayClock || st.shortDetail || ""), ev };
}
function hkClock(ev) {
  const t = (ev.status && ev.status.type) || {}, d = t.shortDetail || "";
  if (t.state === "post") return /SO/.test(d) ? "Terminé (TAB)" : /OT/.test(d) ? "Terminé (prol.)" : "Terminé";
  if (t.state === "pre") return hFmt.format(new Date(ev.date));
  return d.replace(/End of/i, "Fin").replace(/1st/, "1re").replace(/2nd/, "2e").replace(/3rd/, "3e").replace(/\bOT\b/, "Prol.").replace(/\bSO\b/, "TAB").replace(/Intermission/i, "Pause");
}
function wins(code, hs, as, ot) {
  if (/temps régl/.test(code)) { const rh = ot ? 0 : hs, ra = ot ? 0 : as; if (/1X/.test(code)) return rh >= ra; if (/X2/.test(code)) return ra >= rh; }
  if (/Vainqueur.*: 1$/.test(code)) return hs > as; if (/Vainqueur.*: 2$/.test(code)) return as > hs;
  if (/Plus de 5.5/.test(code)) return hs + as > 5; if (/Moins de 5.5/.test(code)) return hs + as < 6;
  switch (code) {
    case "1": return hs > as; case "2": return as > hs; case "N": return hs === as;
    case "1N": return hs >= as; case "N2": return as >= hs;
  }
  if (/V1/.test(code)) return hs > as; if (/V2/.test(code)) return as > hs;
  if (/1X/.test(code)) return hs >= as; if (/X2/.test(code)) return as >= hs;
  if (/Plus de 2.5/.test(code)) return hs + as > 2; if (/Moins de 2.5/.test(code)) return hs + as < 3;
  if (/marquent/.test(code)) return hs > 0 && as > 0;
  return null;
}
async function refreshResults() {
  const now = Date.now();
  const days = [...new Set(matches.map(m => ymdUTC(m.date)))];
  let anyLive = false;
  await Promise.all(days.map(async k => {
    const ms = matches.filter(m => ymdUTC(m.date) === k && !m.result);
    if (!ms.length) return;
    const active = ms.some(m => now > m.date - 15 * 60e3 && now < m.date.getTime() + 150 * 60e3);
    const done = ms.every(m => now > m.date.getTime() + 150 * 60e3);
    if (ms.every(m => now < m.date - 15 * 60e3)) return; // rien n'a commencé ce jour-là
    if (sport === "hockey" && !ms.some(m => m.league === "NHL")) return;
    const age = active ? 4000 : done ? 3600e3 : 120000;
    await fetchDay(k, age); if (sport === "hockey") await fetchDay(prevKey(new Date(k.slice(0, 4) + "-" + k.slice(4, 6) + "-" + k.slice(6) + "T12:00:00Z")), age);
    if (active) anyLive = true;
  }));
  if (matches.length) render(); if (view === "combos") renderCombos(); if (view === "match") renderDetail();
  return anyLive;
}
let resTimer = null;
async function resultsLoop() {
  clearTimeout(resTimer);
  let live = false; try { live = await refreshResults(); } catch (e) {}
  resTimer = setTimeout(resultsLoop, live ? 5000 : 120000);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) { resultsLoop(); liveLoop(false); if (view === "lv") loadLv(); } });

/* ---------- Onglet Live : tous les matchs en cours ---------- */
// Toutes les compétitions suivies pour le direct (les codes inconnus sont ignorés)
const LIVE_LEAGUES = ["uefa.champions", "uefa.europa", "uefa.europa.conf", "eng.1", "esp.1", "ita.1", "ger.1", "fra.1",
  "eng.2", "eng.3", "esp.2", "ita.2", "ger.2", "fra.2", "por.1", "ned.1", "bel.1", "tur.1", "sco.1", "gre.1", "aut.1", "sui.1", "den.1",
  "ksa.1", "usa.1", "mex.1", "bra.1", "arg.1", "caf.champions", "caf.confed", "caf.nations", "fifa.worldq.caf", "uefa.nations",
  "eng.fa", "eng.league_cup", "esp.copa_del_rey", "ita.coppa_italia", "ger.dfb_pokal", "fra.coupe_de_france", "fifa.world", "fifa.friendly"];
const liveBoards = {};      // code -> { at, events, name }
let liveCodes = [], liveScanAt = 0, liveTimer = null, lvDetail = null, lvTimer = null;
const LIVE_HK = ["hockey/nhl"];
const espnPath = code => code.includes("/") ? code : "soccer/" + code;
const sb = code => `https://site.api.espn.com/apis/site/v2/sports/${espnPath(code)}/scoreboard`;
const liveList = () => sport === "hockey" ? LIVE_HK : LIVE_LEAGUES;
async function getBoard(code) {
  try {
    const r = await fetch(sb(code), { cache: "no-store" }); if (!r.ok) return null;
    const j = await r.json();
    const evs = j.events || []; if (code.startsWith("hockey/")) evs.forEach(e => e._hk = true);
    liveBoards[code] = { at: Date.now(), events: evs, name: (j.leagues && j.leagues[0] && (j.leagues[0].abbreviation || j.leagues[0].name)) || code };
    return liveBoards[code];
  } catch (e) { return null; }
}
const isIn = ev => ev.status && ev.status.type && ev.status.type.state === "in";
const soon = ev => ev.status && ev.status.type && ev.status.type.state === "pre" && new Date(ev.date) - Date.now() < 10 * 60e3;
// Toutes les 60 s : repère les compétitions qui ont un match en cours. Toutes les 5 s : actualise seulement celles-là.
async function scanLive() {
  const all = LIVE_LEAGUES.concat(LIVE_HK);
  await Promise.all(all.map(getBoard));
  liveScanAt = Date.now();
  liveCodes = all.filter(c => liveBoards[c] && liveBoards[c].events.some(e => isIn(e) || soon(e)));
}
async function liveLoop(first) {
  clearTimeout(liveTimer);
  if (first || Date.now() - liveScanAt > 60000) await scanLive();
  else await Promise.all(liveCodes.map(getBoard));
  const n = liveCodes.filter(c => liveList().includes(c)).reduce((s, c) => s + liveBoards[c].events.filter(isIn).length, 0);
  $("liveDot").hidden = !n;
  if (view === "live") renderLive();
  liveTimer = setTimeout(() => liveLoop(false), view === "live" || view === "lv" ? (n ? 5000 : 30000) : 60000);
}
function loadLive(force) { if (force) { renderLive(); liveLoop(!liveScanAt); } }
// Chrono : avance à la seconde entre deux actualisations
function clockText(ev, at) {
  const st = ev.status || {}, t = st.type || {};
  if (ev._hk) return hkClock(ev);
  if (t.name === "STATUS_HALFTIME") return "Mi-temps";
  if (t.state !== "in") return t.state === "post" ? "Terminé" : hFmt.format(new Date(ev.date));
  const disp = st.displayClock || "";
  if (/\+/.test(disp) || typeof st.clock !== "number" || !st.clock) return disp;
  const s = Math.floor(st.clock + (Date.now() - at) / 1000), mm = Math.floor(s / 60), ss = s % 60;
  const cap = (st.period || 1) === 1 ? 45 : 90;
  if (mm >= cap) return disp || cap + "'";
  return mm + ":" + String(ss).padStart(2, "0");
}
setInterval(() => document.querySelectorAll("[data-clock]").forEach(el => {
  const [code, id] = el.dataset.clock.split("|"), b = code === "_lv" ? null : liveBoards[code];
  const ev = b ? b.events.find(e => e.id === id) : (lvDetail && lvDetail.ev);
  if (ev) el.textContent = clockText(ev, b ? b.at : lvDetail.at);
}), 1000);
const ICON = { goal: "⚽", "own goal": "⚽", penalty: "⚽", "yellow card": "🟨", "red card": "🟥", substitution: "🔁" };
function evIcon(txt, scoring, hk) { if (hk && (scoring || /goal/i.test(txt || ""))) return "🏒"; const k = String(txt || "").toLowerCase(); if (scoring || /goal|penalty - scored/.test(k)) return "⚽"; if (/red/.test(k)) return "🟥"; if (/yellow/.test(k)) return "🟨"; if (/sub/.test(k)) return "🔁"; return "•"; }
function rowEvents(ev) {
  const c = ev.competitions[0], home = (c.competitors.find(x => x.homeAway === "home") || {}).team || {};
  return (c.details || []).slice(-4).map(d => {
    const who = d.athletesInvolved && d.athletesInvolved[0] ? d.athletesInvolved[0].shortName || d.athletesInvolved[0].displayName : "";
    return `<span class="evc ${d.team && d.team.id === home.id ? "" : "aw"}">${evIcon(d.type && d.type.text, d.scoringPlay, ev._hk)} ${esc((d.clock && d.clock.displayValue) || "")} ${esc(who)}</span>`;
  }).join("");
}
function renderLive() {
  const box = $("live");
  const groups = liveList().filter(c => liveBoards[c] && liveBoards[c].events.some(isIn));
  if (!liveScanAt) { box.innerHTML = '<div class="empty">Recherche des matchs en cours…</div>'; return; }
  if (!groups.length) {
    const next = liveList().flatMap(c => (liveBoards[c] ? liveBoards[c].events : []).filter(e => e.status.type.state === "pre").map(e => ({ e, c })))
      .sort((x, y) => new Date(x.e.date) - new Date(y.e.date))[0];
    box.innerHTML = `<div class="empty"><b>Aucun match en cours pour le moment.</b><br>${next ? `Prochain ${sport === "hockey" ? "engagement" : "coup d'envoi"} à ${hFmt.format(new Date(next.e.date))} : ${esc(next.e.name || "")}.` : "Les matchs apparaîtront ici dès le coup d'envoi."}${sport === "hockey" ? "<br><small>Direct disponible pour la NHL. KHL et ligues européennes : résultats ajoutés chaque matin.</small>" : ""}</div>`;
    $("liveUpd").textContent = "";
    return;
  }
  box.innerHTML = '<div class="day">' + groups.map(code => {
    const b = liveBoards[code];
    const rows = b.events.filter(isIn).map(ev => {
      const c = ev.competitions[0], h = c.competitors.find(x => x.homeAway === "home"), a = c.competitors.find(x => x.homeAway === "away");
      const team = x => `<div class="lteam">${x.team.logo ? `<img src="${esc(x.team.logo)}" alt="" loading="lazy">` : ""}<span>${esc(x.team.shortDisplayName || x.team.displayName)}</span></div>`;
      const evs = rowEvents(ev);
      return `<button class="lrow" data-lv="${code}|${esc(ev.id)}"><span class="lmin on"><span class="pulse"></span><span data-clock="${code}|${esc(ev.id)}">${esc(clockText(ev, b.at))}</span></span>
        <div class="lteams">${team(h)}${team(a)}</div>
        <div class="lscore on"><span>${esc(h.score)}</span><span>${esc(a.score)}</span></div>
        ${evs ? `<div class="evs">${evs}</div>` : ""}</button>`;
    }).join("");
    return `<div class="lgcard"><div class="lghead"><span class="flag live">LIVE</span><div><b>${esc(b.name)}</b></div></div>${rows}</div>`;
  }).join("") + "</div>";
  $("liveUpd").textContent = "Actualisé à " + new Date().toLocaleTimeString("fr-FR");
}


/* ---------- Aperçu 2D : compositions sur le terrain et événements ---------- */
function posGroup(abbr) {
  const a = String(abbr || "").toUpperCase();
  if (/^G/.test(a)) return 0;
  if (/(^|-)(D|CB|CD|LB|RB|SW|LWB|RWB)/.test(a) || a === "D") return 1;
  if (/(^|-)(F|CF|ST|LF|RF|S)$/.test(a) || /^(F|CF|ST)/.test(a)) return 3;
  return 2;
}
const sideOf = abbr => { const a = String(abbr || "").toUpperCase();
  if (/^(LB|LWB|LW|LM|LF)$/.test(a)) return 0; if (/-L$/.test(a)) return 1; if (/^(RB|RWB|RW|RM|RF)$/.test(a)) return 4; if (/-R$/.test(a)) return 3; return 2; };
function lineup(team) {
  const st = (team.roster || []).filter(p => p.starter);
  if (st.length < 11) return null;
  let rows = String(team.formation || "").split("-").map(Number).filter(n => n > 0);
  st.sort((x, y) => posGroup(x.position && x.position.abbreviation) - posGroup(y.position && y.position.abbreviation) || (+x.formationPlace || 0) - (+y.formationPlace || 0));
  if (rows.reduce((s, n) => s + n, 0) !== 10) {
    const c = [1, 2, 3].map(g => st.filter(p => posGroup(p.position && p.position.abbreviation) === g).length);
    rows = c.filter(n => n > 0);
  }
  const out = [[st[0]]]; let i = 1;
  rows.forEach(n => { out.push(st.slice(i, i + n).sort((x, y) => sideOf(x.position && x.position.abbreviation) - sideOf(y.position && y.position.abbreviation))); i += n; });
  return out;
}
function pitch2D(j, h, a) {
  const R = j.rosters || [];
  const rh = R.find(x => x.homeAway === "home"), ra = R.find(x => x.homeAway === "away");
  if (!rh || !ra) return "";
  const lh = lineup(rh), la = lineup(ra);
  if (!lh || !la) return "";
  const evs = {};
  (j.keyEvents || []).forEach(k => (k.participants || []).forEach((p, idx) => {
    const n = p.athlete && p.athlete.displayName; if (!n) return;
    const t = String((k.type && k.type.text) || "").toLowerCase();
    const ic = k.scoringPlay || /goal/.test(t) ? (/own/.test(t) ? "⚽(csc)" : "⚽") : /red/.test(t) ? "🟥" : /yellow/.test(t) ? "🟨" : /sub/.test(t) ? (idx === 0 ? "🔼" : "🔽") : "";
    if (ic) (evs[n] = evs[n] || []).push(ic);
  }));
  // Terrain vertical (lisible sur téléphone) : domicile en bas, extérieur en haut
  const W = 360, H = 560, M = 30;
  const dots = (rows, home) => rows.map((row, ri) => {
    const t = ri / Math.max(rows.length - 1, 1);             // 0 = gardien, 1 = attaque
    const y = home ? H - M - t * (H / 2 - M - 34) : M + t * (H / 2 - M - 34);
    return row.map((p, k) => {
      let x = W * (k + 1) / (row.length + 1); if (!home) x = W - x;
      const name = (p.athlete && (p.athlete.lastName || p.athlete.shortName || p.athlete.displayName)) || "";
      const e = (evs[p.athlete && p.athlete.displayName] || []).join("");
      return `<g class="pl ${home ? "h" : "a"}${p.subbedOut ? " out" : ""}"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y + 4.5}" class="jn">${esc(p.jersey || "")}</text>
        <text x="${x}" y="${y + 27}" class="nm">${esc(String(name).slice(0, 11))}</text>${e ? `<text x="${x + 14}" y="${y - 10}" class="ev">${e}</text>` : ""}</g>`;
    }).join("");
  }).join("");
  return `<div class="dcard"><div class="sechead"><span class="lab">Aperçu 2D · compositions et événements</span></div>
    <div class="pitchwrap"><svg viewBox="0 0 ${W} ${H}" class="pitch" role="img" aria-label="Compositions des deux équipes sur le terrain">
      <rect x="0" y="0" width="${W}" height="${H}" rx="18" class="grass"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => i % 2 ? `<rect x="0" y="${i * H / 8}" width="${W}" height="${H / 8}" class="stripe"/>` : "").join("")}
      <g class="lines"><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="6"/><line x1="10" y1="${H / 2}" x2="${W - 10}" y2="${H / 2}"/>
      <circle cx="${W / 2}" cy="${H / 2}" r="44"/><rect x="${W / 2 - 80}" y="10" width="160" height="70"/><rect x="${W / 2 - 80}" y="${H - 80}" width="160" height="70"/>
      <rect x="${W / 2 - 36}" y="10" width="72" height="26"/><rect x="${W / 2 - 36}" y="${H - 36}" width="72" height="26"/></g>
      <text x="16" y="${H / 2 - 10}" class="tm">${esc(a.team.abbreviation || "")} ${esc(ra.formation || "")}</text>
      <text x="16" y="${H / 2 + 22}" class="tm">${esc(h.team.abbreviation || "")} ${esc(rh.formation || "")}</text>
      ${dots(lh, true)}${dots(la, false)}
    </svg></div>
    <div class="legend"><span><i class="dot h"></i>${esc(h.team.shortDisplayName || h.team.displayName)}</span><span><i class="dot a"></i>${esc(a.team.shortDisplayName || a.team.displayName)}</span><span>⚽ but · 🟨🟥 carton · 🔼🔽 changement</span></div></div>`;
}

/* ---------- Page d'un match en direct : chronologie et statistiques ---------- */
let lvKey = null;
async function loadLv() {
  clearTimeout(lvTimer);
  if (!lvKey) return;
  const [code, id] = lvKey.split("|");
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath(code)}/summary?event=${encodeURIComponent(id)}`, { cache: "no-store" });
    const j = await r.json();
    const comp = j.header && j.header.competitions && j.header.competitions[0];
    lvDetail = { at: Date.now(), j, ev: comp ? { status: comp.status, date: comp.date, _hk: code.startsWith("hockey/") } : null, code, hk: code.startsWith("hockey/") };
  } catch (e) { if (!lvDetail) $("lvDetail").innerHTML = '<button class="back" data-back>‹ Retour</button><div class="empty">Ce match n\'a pas pu être chargé. Vérifie ta connexion.</div>'; }
  if (view === "lv") renderLv();
  const on = lvDetail && lvDetail.ev && lvDetail.ev.status && lvDetail.ev.status.type && lvDetail.ev.status.type.state === "in";
  if (view === "lv") lvTimer = setTimeout(loadLv, on ? 5000 : 30000);
}
function renderLv() {
  if (!lvDetail || !lvDetail.j.header) return;
  const j = lvDetail.j, comp = j.header.competitions[0], st = comp.status.type;
  const h = comp.competitors.find(x => x.homeAway === "home"), a = comp.competitors.find(x => x.homeAway === "away");
  const on = st.state === "in";
  const crest = x => x.team.logos && x.team.logos[0] ? `<img class="lvlogo" src="${esc(x.team.logos[0].href)}" alt="">` : x.team.logo ? `<img class="lvlogo" src="${esc(x.team.logo)}" alt="">` : `<span class="crest">${esc((x.team.abbreviation || "").slice(0, 3))}</span>`;
  const hk = lvDetail.hk;
  const keys = (hk ? (j.plays || []).filter(p => p.scoringPlay || /penalty/i.test((p.type && p.type.text) || "")).map(p => ({ ...p, participants: (p.participants || []).slice(0, 1), clock: { displayValue: ((p.period && p.period.number) ? p.period.number + "e · " : "") + ((p.clock && p.clock.displayValue) || "") } })) : (j.keyEvents || [])).filter(k => k.type && !/kickoff|start|end|halftime/i.test(k.type.text || "") || (k.scoringPlay));
  const timeline = keys.length ? keys.slice().reverse().map(k => {
    const isHome = k.team && h.team && k.team.id === h.team.id;
    const who = (k.participants || []).map(p => p.athlete && p.athlete.displayName).filter(Boolean).join(" ↔ ");
    return `<div class="tl ${isHome ? "" : "aw"}"><span class="tlmin">${esc((k.clock && k.clock.displayValue) || "")}</span><span class="tlic">${hk ? (k.scoringPlay ? "🏒" : "⏱") : evIcon(k.type && k.type.text, k.scoringPlay)}</span><div><b>${esc(who || (k.type && k.type.text) || "")}</b><small>${esc(k.team ? k.team.displayName : "")}</small></div></div>`;
  }).join("") : '<p class="msg">Aucun événement pour le moment.</p>';
  const STAT = [["possessionPct", "Possession", "%"], ["totalShots", "Tirs", ""], ["shotsOnTarget", "Tirs cadrés", ""], ["wonCorners", "Corners", ""], ["foulsCommitted", "Fautes", ""], ["yellowCards", "Cartons jaunes", ""], ["redCards", "Cartons rouges", ""], ["offsides", "Hors-jeu", ""], ["saves", "Arrêts", ""]];
  const bt = (j.boxscore && j.boxscore.teams) || [];
  const tv = (team, name) => { const t = bt.find(x => x.team && x.team.id === team.team.id); const s = t && (t.statistics || []).find(x => x.name === name); return s ? parseFloat(s.displayValue) : null; };
  const statsGen = () => { const th = bt.find(x => x.team && x.team.id === h.team.id), ta = bt.find(x => x.team && x.team.id === a.team.id); if (!th || !ta) return "";
    return (th.statistics || []).slice(0, 10).map(sx => { const sy = (ta.statistics || []).find(y => y.name === sx.name); if (!sy) return ""; const x = parseFloat(sx.displayValue), y = parseFloat(sy.displayValue);
      if (isNaN(x) || isNaN(y)) return ""; const tot = x + y || 1; return `<div class="st"><div class="stn"><b>${esc(sx.displayValue)}</b><span>${esc(sx.label || sx.name)}</span><b>${esc(sy.displayValue)}</b></div><div class="stb"><i style="flex:${x / tot}"></i><i class="aw" style="flex:${y / tot}"></i></div></div>`; }).join(""); };
  const stats = hk ? statsGen() : STAT.map(([k, l, u]) => { const x = tv(h, k), y = tv(a, k); if (x === null || y === null || isNaN(x) || isNaN(y)) return "";
    const tot = x + y || 1; return `<div class="st"><div class="stn"><b>${x}${u}</b><span>${l}</span><b>${y}${u}</b></div><div class="stb"><i style="flex:${x / tot}"></i><i class="aw" style="flex:${y / tot}"></i></div></div>`; }).join("");
  const ours = matches.find(m => { const ev = findEvent(m); return ev && ev.id === comp.id; });
  $("lvDetail").innerHTML = `
    <button class="back" data-back>‹ Retour</button>
    <div class="dhead">
      <div class="lghead plain"><span class="flag live">${on ? "LIVE" : "FOOT"}</span><div><b>${esc((j.header.league && j.header.league.name) || "")}</b></div></div>
      <div class="dteams">
        <div class="dteam">${crest(h)}<b>${esc(h.team.displayName)}</b></div>
        <div class="dmid"><div class="dscore ${on ? "on" : ""}">${esc(h.score || "0")} – ${esc(a.score || "0")}</div>
          <div class="dstate ${on ? "on" : ""}">${on ? '<span class="pulse"></span>' : ""}<span data-clock="_lv|x">${esc(clockText(lvDetail.ev, lvDetail.at))}</span></div></div>
        <div class="dteam">${crest(a)}<b>${esc(a.team.displayName)}</b></div>
      </div>
    </div>
    ${ours ? `<button class="dcard ourp" data-open="${esc(ours.id)}"><span class="lab">Notre prono</span><b>${esc(ours.r.pickLabel)} · ${pc(ours.r.conf)} %</b><span class="msg">Voir l'analyse du match ›</span></button>` : ""}
    ${hk ? "" : pitch2D(j, h, a) || `<div class="dcard"><span class="lab">Aperçu 2D</span><p class="msg">Les compositions d'équipe ne sont pas encore disponibles pour ce match.</p></div>`}
    <div class="dcard"><span class="lab">${hk ? "Buts et pénalités" : "Événements du match"}</span><div class="tlwrap">${timeline}</div></div>
    ${stats ? `<div class="dcard"><span class="lab">Statistiques</span>${stats}</div>` : ""}`;
}

/* ---------- Page de détail d'un match ---------- */
function renderDetail() {
  const m = matches.find(x => x.id === detailId), box = $("detail");
  if (!m) { box.innerHTML = '<div class="empty">Match introuvable. Il ne fait peut-être plus partie de la sélection de la semaine.</div>'; return; }
  if (!canSee(m)) { box.innerHTML = `<button class="back" data-back>‹ Retour</button><div class="combolock"><h2>${esc(m.home.name)} – ${esc(m.away.name)}</h2>
    <p class="msg">Ce match se joue ${dayDiff(m.date) === 1 ? "demain" : "le " + esc(dayFmt.format(m.date))}. Son prono est réservé aux membres, qui voient le programme jusqu'à 3 jours à l'avance.</p><button class="cta" data-join>Devenir membre</button></div>`; return; }
  const r = m.r, h = m.home, a = m.away, res = resultOf(m), st = res && res.state;
  const center = st === "in" ? `<div class="dscore on">${res.hs} – ${res.as}</div><div class="dstate on"><span class="pulse"></span>${esc(res.clock)}</div>`
    : st === "post" ? `<div class="dscore">${res.hs} – ${res.as}</div><div class="dstate">${res.ot ? "Terminé (prol.)" : "Terminé"}</div>`
    : `<div class="dscore time">${hFmt.format(m.date)}</div><div class="dstate">${esc(dayFmt.format(m.date))}</div>`;
  const ok = st === "post" ? wins(r.pick, res.hs, res.as, res.ot) : null;
  const mark = ok === true ? '<span class="res won">✓ Gagné</span>' : ok === false ? '<span class="res lost">✗ Perdu</span>' : st === "in" ? '<span class="res live">En cours</span>' : "";
  const goals = res && res.ev && res.ev.competitions[0].details && !r.hockey ? res.ev.competitions[0].details.filter(d => d.scoringPlay).map(d => {
    const home = d.team && res.ev.competitions[0].competitors.find(x => x.homeAway === "home").team.id === d.team.id;
    const who = (d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].displayName) || "But";
    return `<div class="goal ${home ? "" : "away"}"><span>${esc((d.clock && d.clock.displayValue) || "")}</span><b>⚽ ${esc(who)}</b></div>`; }).join("") : "";
  const formRow = t => `<div class="fchips">${[...String(t.form || "")].map(v => `<i class="fc f${v}">${v}</i>`).join("")}</div>`;
  const per = (n, g) => fmt(n / Math.max(g, 1), 1);
  const premium = isMember() && r.hockey ? `
    <div class="dcard"><span class="lab">Analyse détaillée</span>
      <div class="kv"><span>Buts attendus</span><span>${fmt(r.lh)} – ${fmt(r.la)}</span></div>
      <div class="kv"><span>Victoire prol. incluse 1 / 2</span><span>${pc(r.w1)} % · ${pc(r.w2)} %</span></div>
      <div class="kv"><span>Nul après 60 min (prolongation)</span><span>${pc(r.px)} %</span></div>
      <div class="kv"><span>Plus / moins de 5,5 buts</span><span>${pc(r.o55)} % · ${pc(1 - r.o55)} %</span></div>
      <div class="kv"><span>Cote juste vainqueur 1 / 2</span><span>${fmt(1 / r.w1)} · ${fmt(1 / r.w2)}</span></div></div>
    <div class="dcard"><span class="lab">Scores les plus probables (60 min)</span>
      ${r.sc.map(([i, j, p]) => `<div class="sc"><b>${i}–${j}</b><span class="t"><i style="width:${p / r.sc[0][2] * 100}%"></i></span><span>${fmt(p * 100, 1)} %</span></div>`).join("")}</div>`
    : isMember() ? `
    <div class="dcard"><span class="lab">Analyse détaillée</span>
      <div class="kv"><span>Buts attendus</span><span>${fmt(r.lh)} – ${fmt(r.la)}</span></div>
      <div class="kv"><span>Plus de 2,5 buts</span><span>${pc(r.o25)} %</span></div>
      <div class="kv"><span>Moins de 2,5 buts</span><span>${pc(1 - r.o25)} %</span></div>
      <div class="kv"><span>Les deux équipes marquent</span><span>${pc(r.btts)} %</span></div>
      <div class="kv"><span>Double chance 1X / X2</span><span>${pc(r.p1 + r.px)} % · ${pc(r.p2 + r.px)} %</span></div>
      <div class="kv"><span>Cote juste 1 / N / 2</span><span>${fmt(1 / r.p1)} · ${fmt(1 / r.px)} · ${fmt(1 / r.p2)}</span></div></div>
    <div class="dcard"><span class="lab">Scores les plus probables</span>
      ${r.sc.map(([i, j, p]) => `<div class="sc"><b>${i}–${j}</b><span class="t"><i style="width:${p / r.sc[0][2] * 100}%"></i></span><span>${fmt(p * 100, 1)} %</span></div>`).join("")}</div>`
    : `<div class="dcard lockcard"><b>Analyse détaillée réservée aux membres</b><span class="msg">Buts attendus, plus/moins de 2,5 buts, les deux équipes marquent, scores les plus probables et cotes justes.</span><button class="cta" data-join>Devenir membre</button></div>`;
  box.innerHTML = `
    <button class="back" data-back>‹ Retour</button>
    <div class="dhead">
      <div class="dlg">${lgHead(m.league).replace('class="lghead"', 'class="lghead plain"')}</div>
      <div class="dteams">
        <div class="dteam">${logoOf(m.league, h.name) ? logoImg(m, h, "lvlogo") : `<span class="crest">${esc(h.name.slice(0, 2).toUpperCase())}</span>`}<b>${esc(h.name)}</b><small>Domicile</small></div>
        <div class="dmid">${center}</div>
        <div class="dteam">${logoOf(m.league, a.name) ? logoImg(m, a, "lvlogo") : `<span class="crest away">${esc(a.name.slice(0, 2).toUpperCase())}</span>`}<b>${esc(a.name)}</b><small>Extérieur</small></div>
      </div>
      ${goals ? `<div class="goals">${goals}</div>` : ""}
    </div>
    <div class="dcard"><div class="pickrow"><div><span class="lab">Notre prono</span><b class="bigpick">${esc(r.pickLabel)}</b></div>
      <div class="pickright"><span class="badge c-${r.cls}"><b>${r.pick}</b><small>${CL[r.cls]} ${pc(r.conf)} %</small></span>${mark}</div></div>
      <div class="p3 big"><span class="b"><i style="flex:${r.p1};background:var(--home)"></i><i style="flex:${r.px};background:var(--draw)"></i><i style="flex:${r.p2};background:var(--away)"></i></span>
      <span class="n"><span>1 · ${pc(r.p1)} %</span><span>N · ${pc(r.px)} %</span><span>2 · ${pc(r.p2)} %</span></span></div></div>
    ${premium}
    <div class="dcard"><span class="lab">Forme (5 derniers matchs)</span>
      <div class="kv"><span>${esc(h.name)}</span>${formRow(h)}</div>
      <div class="kv"><span>${esc(a.name)}</span>${formRow(a)}</div></div>
    <div class="dcard"><span class="lab">Saison en cours</span>
      <div class="stat3"><span></span><b>${esc(h.name)}</b><b>${esc(a.name)}</b></div>
      <div class="stat3"><span>Matchs joués</span><b>${h.gp}</b><b>${a.gp}</b></div>
      <div class="stat3"><span>Buts marqués</span><b>${h.gf} <small>(${per(h.gf, h.gp)}/m)</small></b><b>${a.gf} <small>(${per(a.gf, a.gp)}/m)</small></b></div>
      <div class="stat3"><span>Buts encaissés</span><b>${h.ga} <small>(${per(h.ga, h.gp)}/m)</small></b><b>${a.ga} <small>(${per(a.ga, a.gp)}/m)</small></b></div></div>`;
}

/* ---------- Coupons du jour (changent à 00h GMT) ---------- */
let combos = [], comboDay = 0;
function options(m) {
  const r = m.r, H = m.home.name, A = m.away.name;
  if (r.hockey) return [
    [r.w1, "Vainqueur (prol. incluse) : 1", "Victoire " + H], [r.w2, "Vainqueur (prol. incluse) : 2", "Victoire " + A],
    [r.p1 + r.px, "Double chance (temps régl.) : 1X", H + " ou nul après 60 min"], [r.p2 + r.px, "Double chance (temps régl.) : X2", A + " ou nul après 60 min"],
    [r.o55, "Total (prol. incluse) : Plus de 5.5", "Plus de 5,5 buts"], [1 - r.o55, "Total (prol. incluse) : Moins de 5.5", "Moins de 5,5 buts"]
  ].filter(o => o[0] >= 0.5 && o[0] <= 0.92);
  return [
    [r.p1, "1X2 : V1", "Victoire " + H], [r.p2, "1X2 : V2", "Victoire " + A],
    [r.p1 + r.px, "Double chance : 1X", H + " ou nul"], [r.p2 + r.px, "Double chance : X2", A + " ou nul"],
    [r.o25, "Total : Plus de 2.5", "Plus de 2,5 buts"], [1 - r.o25, "Total : Moins de 2.5", "Moins de 2,5 buts"],
    [r.btts, "Les deux équipes marquent : Oui", "Les deux équipes marquent"]
  ].filter(o => o[0] >= 0.5 && o[0] <= 0.92);
}
// Compose un combiné proche de la cote visée à partir des matchs d'une journée.
function build(pool0, target, sizes) {
  let best = null;
  for (const n of sizes) {
    const pStar = Math.pow(1 / target, 1 / n);
    const pool = pool0.map(m => {
      const o = options(m).filter(x => x[0] >= pStar - 0.04).sort((x, y) => Math.abs(x[0] - pStar) - Math.abs(y[0] - pStar))[0];
      return o ? { m, p: o[0], bk: o[1], label: o[2] } : null;
    }).filter(Boolean).sort((x, y) => (y.p - pStar >= 0 ? 0 : 1) - (x.p - pStar >= 0 ? 0 : 1) || Math.abs(x.p - pStar) - Math.abs(y.p - pStar));
    const legs = [];
    for (const c of pool) { if (legs.length >= n) break; if (legs.filter(l => l.m.league === c.m.league).length >= 3) continue; legs.push(c); }
    if (legs.length < n) continue;
    let odds = legs.reduce((s, l) => s / l.p, 1);
    if (odds < target * 0.95) {
      const used = new Set(legs.map(l => l.m.id));
      const extra = pool0.filter(m => !used.has(m.id)).flatMap(m => options(m).map(o => ({ m, p: o[0], bk: o[1], label: o[2] })))
        .filter(c => c.p < pStar).sort((x, y) => y.p - x.p);
      legs.sort((x, y) => y.p - x.p);
      for (const c of extra) { const o2 = odds * legs[0].p / c.p; if (o2 >= target * 0.95) { legs[0] = c; odds = o2; break; } }
    }
    if (odds < target * 0.95 || odds > target * 1.7) continue;
    const cand = { legs: legs.sort((x, y) => x.m.date - y.m.date), odds, prob: legs.reduce((s, l) => s * l.p, 1) };
    if (!best || Math.abs(Math.log(cand.odds / target)) < Math.abs(Math.log(best.odds / target))) best = cand;
  }
  return best;
}
function ticketText(id) {
  const c = combos.find(x => x.id === id); if (!c) return "";
  return `Prono Lab · ${c.title} du ${c.dayLabel} (cote estimée ${fmt(c.odds)})\n` + c.legs.map((l, i) =>
    `${i + 1}. ${l.m.home.name} - ${l.m.away.name} (${hFmt.format(l.m.date)})\n   ${l.bk}`).join("\n");
}
function legState(l) {
  const res = resultOf(l.m); if (!res || res.state === "pre") return { cls: "", txt: "" };
  if (res.state === "in") return { cls: "live", txt: `${res.hs}–${res.as} · ${res.clock}` };
  const w = wins(l.bk, res.hs, res.as, res.ot);
  return { cls: w ? "won" : "lost", txt: (w ? "✓ " : "✗ ") + res.hs + "–" + res.as };
}
function renderCombos() {
  const box = $("combos"); if (!box || !matches.length) return;
  const base = new Date(); base.setUTCDate(base.getUTCDate() + comboDay);
  const key = ymdUTC(base);
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(base);
  $("comboDays").innerHTML = [[-1, "Hier"], [0, "Aujourd'hui"]].map(([o, l]) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + o);
    return `<button role="tab" data-cday="${o}" aria-selected="${o === comboDay}"><small>${l}</small><b>${x.getUTCDate()}</b></button>`; }).join("");
  const dayMatches = matches.filter(m => ymdUTC(m.date) === key);
  combos = [];
  const safe = build(dayMatches, 2, [3, 2, 4]), five = build(dayMatches, 5, [4, 3, 5]);
  if (safe) combos.push({ id: "safe", title: "Coupon sûr", sub: "Les sélections les plus fiables du jour", cls: "", dayLabel, ...safe });
  if (five) combos.push({ id: "five", title: "Coupon cote 5", sub: "Le coup à gros gain du jour", cls: "big", dayLabel, ...five });
  const next = new Date(); next.setUTCHours(24, 0, 0, 0);
  const left = next - Date.now(), hh = Math.floor(left / 3600e3), mm = Math.floor(left % 3600e3 / 60e3);
  const nextDay = matches.filter(m => ymdUTC(m.date) > ymdUTC(new Date())).sort((x, y) => x.date - y.date)[0];
  const info = `<p class="meta">Coupons du ${esc(dayLabel)}${comboDay === 0 ? ` · prochains coupons dans ${hh} h ${String(mm).padStart(2, "0")} (00h GMT)` : ""}</p>`;
  if (!combos.length) {
    box.innerHTML = info + `<div class="empty">${dayMatches.length ? "Pas assez de matchs ce jour-là pour composer un coupon fiable." : (sport === "hockey" ? "Aucun match de hockey suivi ce jour-là." : "Aucun match des cinq grands championnats ce jour-là.")}${comboDay === 0 && nextDay ? ` Prochains coupons le ${esc(dayFmt.format(nextDay.date))}.` : ""}</div>`;
    return;
  }
  if (!isMember() && comboDay === 0) {
    box.innerHTML = info + `<div class="combolock"><div class="blurred"><div></div><div></div><div></div></div>
      <h2>${combos.length} coupon${combos.length > 1 ? "s" : ""} prêt${combos.length > 1 ? "s" : ""} pour aujourd'hui</h2>
      <p class="msg">Un coupon sûr et un coupon cote 5, avec les libellés 1xBet et Melbet et la copie du ticket en un geste. Réservé aux membres.</p>
      <button class="cta" data-join>Devenir membre</button></div>`;
    return;
  }
  box.innerHTML = info + combos.map(c => {
    const states = c.legs.map(legState), lost = states.some(s => s.cls === "lost"), won = states.every(s => s.cls === "won");
    const verdict = won ? '<span class="res won">✓ Coupon gagné</span>' : lost ? '<span class="res lost">✗ Coupon perdu</span>' : "";
    return `<div class="combo">
    <div class="combohead ${c.cls}"><div><h3>${c.title}</h3><p>${c.sub} · ${c.legs.length} sélections</p>${verdict}</div>
      <div class="odds"><b>${fmt(c.odds)}</b><span>${pc(c.prob)} % de chances</span></div></div>
    ${c.legs.map((l, i) => `<button class="leg" data-open="${esc(l.m.id)}"><span class="mt">${logoImg(l.m, l.m.home)}${esc(l.m.home.name)} – ${esc(l.m.away.name)}${logoImg(l.m, l.m.away)}</span>
      <span class="o">${states[i].txt ? `<em class="res ${states[i].cls}">${esc(states[i].txt)}</em>` : fmt(1 / l.p)}<small>${pc(l.p)} %</small></span>
      <span class="mk">${esc(l.bk)} · ${LGS[l.m.league]} · ${hFmt.format(l.m.date)}</span></button>`).join("")}
    <div class="combofoot"><span class="msg">Cote estimée par le modèle : chez 1xBet ou Melbet, elle sera un peu plus basse.</span>
      <button class="cta" data-ticket="${c.id}">Copier le ticket</button></div></div>`; }).join("")
    + `<p class="note">Un coupon ne passe que si toutes les sélections passent : un coupon cote 5 a environ 1 chance sur 5 de gagner. Mise uniquement ce que tu peux te permettre de perdre.</p>`;
}
setInterval(() => { if (view === "combos") renderCombos(); }, 60000);

/* ---------- Aide : FAQ et assistance ---------- */
const FAQ = [
  ["Comment sont calculés les pronos ?", "L'app compare les buts marqués et encaissés de chaque équipe à la moyenne de son championnat, ajoute l'avantage du terrain et la forme récente, puis calcule les probabilités avec un modèle statistique. Fort = 60 % et plus, Moyen = 45 à 60 %, Risqué = moins de 45 %."],
  ["Comment devenir membre ?", "Onglet Compte : crée ton compte, choisis Hebdo (1000 F CFA) ou Mensuel (3000 F CFA), paie par Orange Money, Moov Money ou Wave, puis envoie la référence de la transaction."],
  ["Quand mon abonnement est-il activé ?", "Dès que le paiement est vérifié, en général dans la journée. Si c'est long, écris-nous sur WhatsApp avec ta référence."],
  ["Quand changent les coupons ?", "Chaque jour à 00h GMT, à partir des matchs du jour. Après les matchs, chaque sélection affiche ✓ (gagnée) ou ✗ (perdue)."],
  ["Les pronos sont-ils garantis ?", "Non : ce sont des estimations, jamais des certitudes. Ne mise que ce que tu peux te permettre de perdre."]
];
function renderHelp() {
  const n = normPhone(CFG.adminPhone), pretty = "+" + n.slice(0, 3) + " " + n.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ");
  const wa = "https://wa.me/" + n + "?text=" + encodeURIComponent("Bonjour, j'ai une question sur Prono Lab : ");
  $("help").innerHTML = `
    <div class="assist">
      <div><h2>Assistance</h2><p class="msg">Une question sur un paiement, ton compte ou un prono ? Notre équipe te répond sur WhatsApp.</p></div>
      <a class="cta wa" href="${wa}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>
      <div class="pay"><span>Numéro</span><code>${esc(pretty)}</code><button class="mini" data-copy="${esc(pretty)}">Copier</button></div>
    </div>
    <button class="linkrow" data-cgu>Conditions d'utilisation <span>›</span></button>
    <div class="faq"><h2>Questions fréquentes</h2>
      ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
}

/* ---------- Mode nuit ---------- */
const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function themeMode() { try { return localStorage.getItem("pl_theme") || "auto"; } catch (e) { return "auto"; } }
function applyTheme() {
  const m = themeMode(), dark = m === "dark" || (m === "auto" && mq && mq.matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  $("themeColor").setAttribute("content", dark ? "#0f1513" : "#f2f6f3");
  $("themeBtn").textContent = dark ? "☀️" : "🌙";
  $("themeBtn").setAttribute("aria-label", dark ? "Activer le mode jour" : "Activer le mode nuit");
}
$("themeBtn").onclick = () => { const dark = document.documentElement.getAttribute("data-theme") === "dark"; try { localStorage.setItem("pl_theme", dark ? "light" : "dark"); } catch (e) {} applyTheme(); };
if (mq && mq.addEventListener) mq.addEventListener("change", () => { if (themeMode() === "auto") applyTheme(); });
applyTheme();

/* ---------- Installation ---------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("installBtn").hidden = true; };
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

/* ---------- Conditions d'utilisation (à accepter à la première ouverture) ---------- */
const CGU_VERSION = "2026-10-30";
const cguAcceptedAt = () => { try { const v = JSON.parse(localStorage.getItem("pl_cgu") || "null"); return v && v.v === CGU_VERSION ? v.at : null; } catch (e) { return null; } };
let cguThen = null;
function showCgu(readOnly, then) {
  cguThen = then || null;
  const box = $("cgu"); box.hidden = false; document.body.style.overflow = "hidden";
  box.classList.toggle("ro", !!readOnly);
  $("cguAge").checked = false; $("cguOk").checked = false; $("cguBtn").disabled = true;
  $("cguBody").scrollTop = 0;
}
function closeCgu() { $("cgu").hidden = true; document.body.style.overflow = ""; const t = cguThen; cguThen = null; if (t) t(); }
document.addEventListener("change", e => { if (e.target.id === "cguAge" || e.target.id === "cguOk") $("cguBtn").disabled = !($("cguAge").checked && $("cguOk").checked); });
$("cguBtn").onclick = () => { try { localStorage.setItem("pl_cgu", JSON.stringify({ v: CGU_VERSION, at: new Date().toISOString() })); } catch (e) {} closeCgu(); };
$("cguClose").onclick = () => closeCgu();
$("cguRefuse").onclick = () => { $("cguMsg").textContent = "Tu dois accepter les conditions d'utilisation et confirmer avoir 18 ans ou plus pour utiliser Prono Lab."; };

/* ---------- Présentation en 3 slides (première ouverture) ---------- */
(function intro() {
  let done = false; try { done = localStorage.getItem("pl_intro") === "1"; } catch (e) {}
  const box = $("intro");
  if (done || !box) { if (!cguAcceptedAt()) showCgu(false); return; }
  box.hidden = false; document.body.style.overflow = "hidden";
  const sl = $("slides"), dots = [...$("dots").children], next = $("introNext"), login = $("introLogin");
  const idx = () => Math.round(sl.scrollLeft / sl.clientWidth);
  const update = () => { const i = idx(); dots.forEach((d, k) => d.classList.toggle("on", k === i));
    const last = i === dots.length - 1; next.textContent = last ? "Créer mon compte" : "Suivant"; login.hidden = !last; };
  const close = tab => { try { localStorage.setItem("pl_intro", "1"); } catch (e) {} box.hidden = true; document.body.style.overflow = "";
    if (!cguAcceptedAt()) { showCgu(false, () => close2(tab)); return; } close2(tab); };
  const close2 = tab => {
    if (tab) { authTab = tab; skipped = false; try { localStorage.removeItem("pl_skip"); } catch (e) {} renderWelcome(); go("compte"); } };
  sl.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  window.addEventListener("resize", update);
  next.onclick = () => { const i = idx(); if (i < dots.length - 1) sl.scrollTo({ left: (i + 1) * sl.clientWidth, behavior: "smooth" }); else close("create"); };
  login.onclick = () => close("login");
  $("introSkip").onclick = () => close(null);
})();

go(location.hash.slice(1) || "matchs", false);
loadMatches();
initFirebase();
renderHelp();
liveLoop(true);
(() => { const r = new URLSearchParams(location.search).get("ref"); if (r) { $("aRef").value = digits(r).slice(-8); authTab = "create"; skipped = false; } })();
