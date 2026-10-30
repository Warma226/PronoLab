/* Prono Lab — application autonome (matchs + comptes + abonnements) */
const CFG = window.PL_CONFIG || {};
const PLANS = CFG.plans;
const LG = { ALL: "Tous", PL: "Premier League", LIGA: "Liga", SA: "Serie A", BL: "Bundesliga", L1: "Ligue 1" };
const LGS = { PL: "PL", LIGA: "Liga", SA: "Serie A", BL: "Bundes.", L1: "L1" };
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

/* ---------- Affichage des matchs ---------- */
const formHtml = f => '<span class="form" aria-label="Forme : ' + esc(f) + '">' + [...String(f || "")].map(v => '<i class="f' + v + '"></i>').join("") + "</span>";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const hFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const CL = { fort: "Fort", moyen: "Moyen", risque: "Risqué" };
const LOCKD = `<div class="lockdet"><span>Buts attendus, scores probables et marchés : réservé aux membres.</span><button class="cta" data-join>Devenir membre</button></div>`;

function card(m) {
  const r = m.r, h = m.home, a = m.away, o = open.has(m.id);
  return `<div class="m"><button aria-expanded="${o}" data-id="${esc(m.id)}">
    <span class="time">${hFmt.format(m.date)}<small>${LGS[m.league] || ""}</small></span>
    <span class="vs"><span class="row ${r.p1 > r.p2 ? "fav" : ""}"><span class="tn">${esc(h.name)}</span>${formHtml(h.form)}</span>
      <span class="row ${r.p2 > r.p1 ? "fav" : ""}"><span class="tn">${esc(a.name)}</span>${formHtml(a.form)}</span></span>
    <span class="p3"><span class="b"><i style="flex:${r.p1};background:var(--home)"></i><i style="flex:${r.px};background:var(--draw)"></i><i style="flex:${r.p2};background:var(--away)"></i></span>
      <span class="n"><span>1 · ${pc(r.p1)}</span><span>N · ${pc(r.px)}</span><span>2 · ${pc(r.p2)}</span></span></span>
    <span class="badge c-${r.cls}"><b>${r.pick}</b><small>${CL[r.cls]} ${pc(r.conf)} %</small></span>
  </button>${o ? (isMember() ? `<div class="det">
    <div class="k"><span class="lab">Notre prono</span>
      <div class="kv"><span>${esc(r.pickLabel)}</span><span>${pc(r.conf)} %</span></div>
      <div class="kv"><span>Buts attendus</span><span>${fmt(r.lh)} – ${fmt(r.la)}</span></div>
      <div class="kv"><span>Plus de 2,5 buts</span><span>${pc(r.o25)} %</span></div>
      <div class="kv"><span>Les deux marquent</span><span>${pc(r.btts)} %</span></div>
      <div class="kv"><span>Cote juste 1 / N / 2</span><span>${fmt(1 / r.p1)} · ${fmt(1 / r.px)} · ${fmt(1 / r.p2)}</span></div></div>
    <div class="k"><span class="lab">Scores les plus probables</span>
      ${r.sc.map(([i, j, p]) => `<div class="sc"><b>${i}–${j}</b><span class="t"><i style="width:${p / r.sc[0][2] * 100}%"></i></span><span>${fmt(p * 100, 1)} %</span></div>`).join("")}</div>
    <div class="k"><span class="lab">Saison en cours</span>
      <div class="kv"><span>${esc(h.name)}</span><span>${h.gf} marqués · ${h.ga} encaissés · ${h.gp} m.</span></div>
      <div class="kv"><span>${esc(a.name)}</span><span>${a.gf} marqués · ${a.ga} encaissés · ${a.gp} m.</span></div></div>
  </div>` : LOCKD) : ""}</div>`;
}
const LGMETA = { PL: ["ENG", "Angleterre", "#6a4fb3"], LIGA: ["ESP", "Espagne", "#e0873a"], SA: ["ITA", "Italie", "#3a7bd5"], BL: ["GER", "Allemagne", "#d9534f"], L1: ["FRA", "France", "#2c4a7a"] };
const LGORDER = ["PL", "LIGA", "SA", "BL", "L1"];
const dayKey = d => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
let selDay = null;
function lgHead(k, extra = "") {
  const m = LGMETA[k] || ["", "", "#888"];
  return `<div class="lghead"><span class="flag" style="background:${m[2]}">${m[0]}</span><div><b>${LG[k] || k}</b><br><span>${m[1]}${extra}</span></div></div>`;
}
function renderDays() {
  const keys = [...new Set(matches.map(m => dayKey(m.date)))].sort((a, b) => new Date(a.replace(/-/g, "/")) - new Date(b.replace(/-/g, "/")));
  if (!selDay || !keys.includes(selDay)) {
    const now = Date.now() - 2 * 3600e3;
    const nextM = matches.filter(m => m.date.getTime() > now).sort((x, y) => x.date - y.date)[0];
    selDay = nextM ? dayKey(nextM.date) : keys[0];
  }
  const wd = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
  $("days").innerHTML = (sort === "conf" ? "" : "") + keys.map(k => { const d = matches.find(m => dayKey(m.date) === k).date;
    return `<button role="tab" data-day="${k}" aria-selected="${k === selDay}"><small>${wd.format(d).replace(".", "")}</small><b>${d.getDate()}</b></button>`; }).join("");
}
function render() {
  if (!matches.length) return;
  const now = Date.now() - 2 * 3600e3;
  const up = matches.filter(m => m.date.getTime() > now);
  const pool = up.length ? up : matches;
  const top = [...pool].filter(m => m.r.pick.length === 1 && m.r.pick !== "N").sort((x, y) => y.r.conf - x.r.conf).slice(0, 5);
  $("topSec").hidden = !top.length;
  const lock = !isMember(); $("topSec").classList.toggle("locked", lock);
  let ov = $("lockov");
  if (lock && !ov) {
    ov = document.createElement("div"); ov.id = "lockov"; ov.className = "lockover";
    ov.innerHTML = `<div><b>Les 5 coups sûrs du week-end</b><span class="msg">Réservés aux membres · dès ${cfa(PLANS.week.price)} la semaine</span><button class="cta" data-join>Devenir membre</button></div>`;
    $("topSec").appendChild(ov);
  }
  if (!lock && ov) ov.remove();
  $("picks").innerHTML = top.map(m => `<button class="pick" data-id="${esc(m.id)}"><span class="lg">${LG[m.league]} · ${dayFmt.format(m.date).split(" ")[0]} ${hFmt.format(m.date)}</span>
    <span class="teams">${esc(m.home.name)}<br>${esc(m.away.name)}</span>
    <span class="bet"><b>${esc(m.r.pickLabel)}</b><span>${pc(m.r.conf)}%</span></span></button>`).join("");
  renderDays();
  const list = matches.filter(m => (filter === "ALL" || m.league === filter) && (sort === "conf" || dayKey(m.date) === selDay));
  $("days").hidden = sort === "conf";
  if (!list.length) { $("list").innerHTML = '<div class="empty">Aucun match pour ce filtre.</div>'; return; }
  if (sort === "conf") {
    list.sort((x, y) => y.r.conf - x.r.conf);
    $("list").innerHTML = '<div class="lgcard">' + list.map(card).join("") + "</div>";
    return;
  }
  list.sort((x, y) => x.date - y.date);
  $("list").innerHTML = '<div class="day">' + LGORDER.filter(k => list.some(m => m.league === k)).map(k =>
    `<div class="lgcard">${lgHead(k)}${list.filter(m => m.league === k).map(card).join("")}</div>`).join("") + "</div>";
}
function chips() {
  const present = new Set(matches.map(m => m.league));
  $("lgChips").innerHTML = Object.keys(LG).filter(k => k === "ALL" || present.has(k)).map(k => `<button class="chip" data-lg="${k}" aria-pressed="${k === filter}">${LG[k]}</button>`).join("");
}
async function loadMatches() {
  try {
    const res = await fetch("data/matches.json?t=" + Date.now(), { cache: "no-store" });
    const x = await res.json();
    matches = (x.matches || []).map(m => ({ ...m, date: new Date(m.kickoff), r: analyse(m) }));
    $("upd").textContent = "Week-end du " + (x.weekend || "") + " · mis à jour le " + new Date(x.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    $("src").textContent = x.sources ? "Sources : " + x.sources : "";
    if (!matches.length) { $("list").innerHTML = '<div class="empty">Les matchs du prochain week-end arrivent bientôt. La liste se met à jour toute seule chaque semaine.</div>'; return; }
    chips(); render(); renderCombos();
  } catch (e) {
    $("list").innerHTML = '<div class="empty">Les matchs n\'ont pas pu être chargés. Vérifie ta connexion internet puis rouvre l\'app.</div>';
  }
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
function renderClub() { renderClubBody(); const c = $("club"); if (me && !asVisitor) c.insertAdjacentHTML("beforeend", `<div><button class="mini" id="logoutBtn">Se déconnecter</button></div>`); }
function renderClubBody() {
  const c = $("club"); c.hidden = false;
  if (!fs) { c.className = "club"; c.innerHTML = `<h2>Espace membre</h2><p class="msg">Les comptes et abonnements arrivent très bientôt.</p>`; return; }
  if (owner()) {
    c.className = "club on";
    c.innerHTML = `<h2>Espace membre <small>Tu es l'administrateur</small></h2><p class="msg">Tu vois tout le contenu débloqué. Les demandes d'abonnement s'affichent en bas de page, dans « Gestion des membres ».</p><div><button class="cta" id="visitBtn">Voir l'app comme un visiteur</button></div>`;
    return;
  }
  const pv = asVisitor ? `<div class="preview"><span class="msg"><b>Aperçu visiteur</b> : c'est ce que voient tes clients. Rien n'est enregistré.</span><button class="mini" id="adminBtn">Revenir en mode administrateur</button></div>` : "";
  const acc = asVisitor ? null : myAcc, mem = asVisitor ? null : myMember, req = asVisitor ? null : myReq;
  if (isMember()) {
    c.className = "club on";
    c.innerHTML = `<h2>Membre actif${acc ? ` <small>${esc(acc.name)}</small>` : ""}</h2><p class="msg ok">Ton accès est valable jusqu'au ${esc(dFmt(mem.until))} inclus. Les coups sûrs et le détail de chaque match sont débloqués.</p>`;
    return;
  }
  if (!acc && !asVisitor) {
    c.className = "club";
    c.innerHTML = `<div class="clubhead"><div><h2>Deviens membre</h2><p class="msg">Crée ton compte ou connecte-toi, puis choisis ta formule : ${cfa(PLANS.week.price)} la semaine ou ${cfa(PLANS.month.price)} le mois.</p></div><button class="cta" id="openAcc">${me ? "Terminer mon compte" : "Créer mon compte"}</button></div>`;
    return;
  }
  const nums = PAYS.filter(([k]) => payment[k]);
  const pending = req && req.status === "pending";
  const expired = mem && !isMember();
  const save = PLANS.week.price * 4 - PLANS.month.price;
  c.className = "club";
  c.innerHTML = pv + `<div class="clubhead">
      <div><h2>${expired ? "Ton abonnement a expiré" : "Deviens membre"}</h2><p class="msg">Débloque les 5 coups sûrs du week-end et l'analyse complète de chaque match.</p></div>
      <div class="price">dès ${PLANS.week.price} <small>F CFA / semaine</small></div></div>
    ${pending ? `<p class="msg ok">Demande ${esc((PLANS[req.plan] || PLANS.week).label.toLowerCase())} envoyée le ${esc(dFmt(req.at))} (référence ${esc(req.ref)}). Ton accès sera activé dès que le paiement sera vérifié.</p>` : ""}
    ${req && req.status === "refused" ? `<p class="msg err">Ta dernière demande n'a pas pu être validée : le paiement n'a pas été retrouvé. Vérifie la référence et renvoie une demande.</p>` : ""}
    <div class="steps">
      <div class="step"><b>1 · Choisis ta formule</b>
        <div class="plans" role="radiogroup" aria-label="Formule">
          <label class="plan" for="pWeek"><input type="radio" name="plan" id="pWeek" value="week" ${selPlan === "week" ? "checked" : ""}><span>${PLANS.week.label} · ${PLANS.week.days} jours</span><b>${cfa(PLANS.week.price)}</b></label>
          <label class="plan" for="pMonth"><input type="radio" name="plan" id="pMonth" value="month" ${selPlan === "month" ? "checked" : ""}><span>${PLANS.month.label} · ${PLANS.month.days} jours</span><b>${cfa(PLANS.month.price)}</b>${save > 0 ? `<em>${save.toLocaleString("fr-FR")} F d'économie</em>` : ""}</label>
        </div>
        <b>2 · Envoie le montant</b>
        ${nums.length ? nums.map(([k, l]) => `<div class="pay"><span>${l}</span><code>${esc(payment[k])}</code><button class="mini" data-copy="${esc(payment[k])}">Copier</button></div>`).join("") : `<p class="msg">Les numéros de paiement seront affichés ici très bientôt.</p>`}
      </div>
      <div class="step"><b>3 · Confirme ton paiement</b>
        <form id="joinForm">
          <label for="jMethod">Moyen de paiement<select id="jMethod">${PAYS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
          <label for="jPhone">Numéro qui a payé<input id="jPhone" inputmode="tel" required placeholder="ex. 70 00 00 00"></label>
          <label for="jRef">Référence de la transaction<input id="jRef" required placeholder="reçue par SMS"></label>
          <button class="cta" type="submit">${pending ? "Renvoyer ma demande" : "Envoyer ma demande"}</button>
          <p class="msg" id="joinMsg"></p>
        </form></div>
    </div>`;
  if (req && req.method) $("jMethod").value = req.method;
  $("jPhone").value = (req && req.phone) || (acc && acc.phone) || "";
}
function renderAdmin() {
  if (!owner()) { $("admin").hidden = true; return; }
  $("admin").hidden = false;
  const n = Object.keys(accounts).length, nm = Object.values(members).filter(m => new Date(m.until) > new Date()).length;
  $("accCount").textContent = `${n} compte${n > 1 ? "s" : ""} · ${nm} membre${nm > 1 ? "s" : ""} actif${nm > 1 ? "s" : ""}`;
  const pend = reqs.filter(r => r.status === "pending").sort((a, b) => String(a.at).localeCompare(String(b.at)));
  $("reqs").innerHTML = pend.length ? pend.map(r => {
    const m = members[r.id], act = m && new Date(m.until) > new Date(), pl = PLANS[r.plan] || PLANS.week, acc = accounts[r.id];
    return `<div class="req"><div class="who"><b>${acc ? esc(acc.name) : "Client"}</b>
      <span>${pl.label} · ${cfa(pl.price)} · ${esc((PAYS.find(p => p[0] === r.method) || [, r.method])[1])} · ${esc(r.phone)} · réf. ${esc(r.ref)}</span>
      ${acc ? `<span>Compte : ${esc(acc.phone)}${acc.city ? " · " + esc(acc.city) : ""}</span>` : ""}
      <span>Envoyée le ${esc(new Date(r.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}${act ? " · déjà membre jusqu'au " + esc(dFmt(m.until)) : ""}</span></div>
      <div class="act"><button class="cta alt" data-ok="${esc(r.id)}">Valider ${pl.days} jours</button><button class="mini" data-no="${esc(r.id)}">Refuser</button></div></div>`;
  }).join("") : '<p class="msg">Aucune demande pour le moment.</p>';
  const act = Object.entries(members).filter(([, m]) => new Date(m.until) > new Date()).sort((a, b) => a[1].until.localeCompare(b[1].until));
  $("mems").innerHTML = act.length ? act.map(([id, m]) => `<div class="kv"><span>${esc((accounts[id] && accounts[id].name) || "Client")} · ${esc((accounts[id] && accounts[id].phone) || "")}</span><span>jusqu'au ${esc(new Date(m.until).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</span></div>`).join("") : '<p class="msg">Aucun membre actif.</p>';
}
function renderAll() { renderTop(); renderWelcome(); renderClub(); renderAdmin(); render(); renderCombos(); }

/* ---------- Firebase ---------- */
function stopListeners(list) { list.forEach(u => { try { u(); } catch (e) {} }); list.length = 0; }
function initFirebase() {
  if (!CFG.firebase || !window.firebase) { renderAll(); return; }
  fb = firebase.initializeApp(CFG.firebase); auth = firebase.auth(); fs = firebase.firestore();
  fs.collection("meta").doc("payment").onSnapshot(d => { payment = d.exists ? d.data() : {};
    if (isOwner) { $("nOrange").value = payment.orange || ""; $("nMoov").value = payment.moov || ""; $("nWave").value = payment.wave || ""; }
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
        $("nOrange").value = payment.orange || ""; $("nMoov").value = payment.moov || ""; $("nWave").value = payment.wave || "";
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
  "auth/operation-not-allowed": "La connexion par mot de passe n'est pas activée dans Firebase (Authentication > E-mail/Mot de passe).",
  "auth/configuration-not-found": "Authentication n'est pas encore activé dans Firebase.",
  "auth/unauthorized-domain": "Ce site n'est pas dans les domaines autorisés de Firebase.",
  "auth/invalid-email": "Ce numéro de téléphone n'est pas valide.",
  "permission-denied": "Le compte est créé mais le profil est bloqué : les règles Firestore ne sont pas publiées.",
  "not-found": "La base Firestore n'existe pas encore dans Firebase.",
  "unavailable": "Firebase ne répond pas. Vérifie ta connexion et réessaie."
};

/* ---------- Événements ---------- */
document.addEventListener("click", async e => {
  const t = e.target;
  const c = t.closest("[data-lg]"); if (c) { filter = c.dataset.lg; chips(); render(); return; }
  const gb = t.closest("[data-go]"); if (gb) { go(gb.dataset.go); return; }
  if (t.closest("[data-join]")) { go("compte"); setTimeout(() => $("club").scrollIntoView({ behavior: "smooth", block: "start" }), 50); return; }
  const dy = t.closest("[data-day]"); if (dy) { selDay = dy.dataset.day; render(); return; }
  const ld = t.closest("[data-lday]"); if (ld) { liveOff = +ld.dataset.lday; loadLive(true); return; }
  const cc = t.closest("[data-ticket]"); if (cc) { const txt = ticketText(cc.dataset.ticket); try { await navigator.clipboard.writeText(txt); cc.textContent = "Ticket copié"; } catch (err) { cc.textContent = "Copie impossible"; } return; }
  if (t.closest("#logoutBtn")) { await auth.signOut(); skipped = false; return; }
  if (t.closest("#tabCreate")) { authTab = "create"; renderWelcome(); return; }
  if (t.closest("#tabLogin")) { authTab = "login"; renderWelcome(); return; }
  if (t.closest("#accBtn")) { if (!me) { skipped = false; authTab = "login"; renderWelcome(); } go("compte"); return; }
  if (t.closest("#openAcc")) { skipped = false; try { localStorage.removeItem("pl_skip"); } catch (err) {} authTab = "create"; renderWelcome(); go("compte"); return; }
  if (t.closest("#skipBtn")) { skipped = true; if (!asVisitor) { try { localStorage.setItem("pl_skip", "1"); } catch (err) {} } renderWelcome(); return; }
  if (t.closest("#visitBtn")) { asVisitor = true; skipped = false; authTab = "create"; renderAll(); go("matchs"); return; }
  if (t.closest("#adminBtn")) { asVisitor = false; renderAll(); return; }
  const cp = t.closest("[data-copy]"); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = "Copié"; } catch (err) {} return; }
  const ok = t.closest("[data-ok]"); if (ok) { validate(ok.dataset.ok, ok); return; }
  const no = t.closest("[data-no]"); if (no) { no.disabled = true; try { await fs.collection("requests").doc(no.dataset.no).update({ status: "refused" }); } catch (err) { no.disabled = false; } return; }
  const p = t.closest(".pick"); if (p) {
    open.add(p.dataset.id); filter = "ALL"; sort = "time"; $("sTime").setAttribute("aria-pressed", "true"); $("sConf").setAttribute("aria-pressed", "false"); chips(); render();
    const el = document.querySelector('.m>button[data-id="' + CSS.escape(p.dataset.id) + '"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); return;
  }
  const b = t.closest(".m>button"); if (b) { const id = b.dataset.id; open.has(id) ? open.delete(id) : open.add(id); render(); }
});
document.addEventListener("change", e => { if (e.target.name === "plan") selPlan = e.target.value; });
document.addEventListener("submit", async e => {
  e.preventDefault();
  if (e.target.id === "accForm") {
    const msg = $("accMsg"), btn = $("accSubmit");
    const name = $("aName").value.trim(), phone = $("aPhone").value.trim(), city = $("aCity").value.trim(), pass = $("aPass").value;
    const needProfile = me && !asVisitor && !myAcc, create = authTab === "create" || needProfile;
    if (asVisitor) { msg.className = "msg"; msg.textContent = "Aperçu : rien n'est enregistré. Pour un vrai client, son compte est créé ici."; return; }
    if (create && !name) { msg.className = "msg err"; msg.textContent = "Indique ton prénom ou un pseudo."; return; }
    if (!needProfile && digits(phone).length < 8) { msg.className = "msg err"; msg.textContent = "Indique un numéro de téléphone complet."; return; }
    if (!needProfile && pass.length < 6) { msg.className = "msg err"; msg.textContent = "Le mot de passe doit contenir au moins 6 caractères."; return; }
    btn.disabled = true; msg.className = "msg"; msg.textContent = create ? "Création du compte…" : "Connexion…";
    try {
      if (needProfile) await fs.collection("accounts").doc(me.uid).set({ name, phone: me.email.split("@")[0], city, createdAt: new Date().toISOString() });
      else if (create) {
        const cred = await auth.createUserWithEmailAndPassword(phoneEmail(phone), pass);
        await fs.collection("accounts").doc(cred.user.uid).set({ name, phone: "+" + normPhone(phone), city, createdAt: new Date().toISOString() });
      } else await auth.signInWithEmailAndPassword(phoneEmail(phone), pass);
      msg.textContent = ""; e.target.reset();
    } catch (err) { msg.className = "msg err"; msg.textContent = (AUTH_ERR[err.code] || "Ça n'a pas marché.") + " (code : " + (err.code || err.message || "inconnu") + ")"; console.error(err); }
    btn.disabled = false; return;
  }
  if (e.target.id === "joinForm") {
    const msg = $("joinMsg"), btn = e.target.querySelector("button");
    if (asVisitor) { msg.className = "msg"; msg.textContent = "Aperçu : la demande n'est pas envoyée. Celle d'un vrai client apparaît dans « Gestion des membres »."; return; }
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
  if (e.target.id === "payForm") {
    const msg = $("payMsg");
    try { await fs.collection("meta").doc("payment").set({ orange: $("nOrange").value.trim(), moov: $("nMoov").value.trim(), wave: $("nWave").value.trim() }); msg.className = "msg ok"; msg.textContent = "Numéros enregistrés."; }
    catch (err) { msg.className = "msg err"; msg.textContent = "Enregistrement impossible. Réessaie."; }
  }
});
async function validate(id, btn) {
  btn.disabled = true;
  try {
    const cur = members[id], base = cur && new Date(cur.until) > new Date() ? new Date(cur.until) : new Date();
    const r = reqs.find(x => x.id === id), days = (PLANS[r && r.plan] || PLANS.week).days;
    const until = new Date(base.getTime() + days * 864e5); until.setHours(23, 59, 0, 0);
    await fs.collection("members").doc(id).set({ until: until.toISOString(), since: (cur && cur.since) || new Date().toISOString(), plan: (r && r.plan) || "week" });
    await fs.collection("requests").doc(id).update({ status: "validated", validatedAt: new Date().toISOString() });
  } catch (err) { btn.disabled = false; btn.textContent = "Échec, réessayer"; }
}
$("sTime").onclick = () => { sort = "time"; $("sTime").setAttribute("aria-pressed", "true"); $("sConf").setAttribute("aria-pressed", "false"); render(); };
$("sConf").onclick = () => { sort = "conf"; $("sConf").setAttribute("aria-pressed", "true"); $("sTime").setAttribute("aria-pressed", "false"); render(); };
$("forgot").onclick = () => { $("accMsg").className = "msg"; $("accMsg").textContent = "Mot de passe oublié ? Écris à l'administrateur sur WhatsApp au +" + normPhone(CFG.adminPhone) + " pour le réinitialiser."; };

/* ---------- Navigation par onglets ---------- */
const VIEWS = ["matchs", "live", "combos", "compte"];
let view = "matchs";
function go(v, push = true) {
  if (!VIEWS.includes(v)) v = "matchs";
  view = v;
  document.querySelectorAll("[data-view]").forEach(el => el.hidden = el.dataset.view !== v);
  document.querySelectorAll(".tabbar [data-go]").forEach(b => { if (b.dataset.go === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (push && location.hash !== "#" + v) history.replaceState(null, "", "#" + v);
  window.scrollTo(0, 0);
  if (v === "live") loadLive(true);
}
window.addEventListener("hashchange", () => go(location.hash.slice(1), false));

/* ---------- Live (scores en direct) ---------- */
const ESPN = { PL: "eng.1", LIGA: "esp.1", SA: "ita.1", BL: "ger.1", L1: "fra.1" };
let liveOff = 0, liveTimer = null, liveData = null;
const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
async function loadLive(force) {
  clearTimeout(liveTimer);
  const d = new Date(); d.setDate(d.getDate() + liveOff);
  const labels = { "-1": "Hier", "0": "Aujourd'hui", "1": "Demain" };
  $("liveDays").innerHTML = [-1, 0, 1].map(o => { const x = new Date(); x.setDate(x.getDate() + o);
    return `<button role="tab" data-lday="${o}" aria-selected="${o === liveOff}"><small>${labels[o]}</small><b>${x.getDate()}</b></button>`; }).join("");
  if (force && !liveData) $("live").innerHTML = '<div class="empty">Chargement des scores…</div>';
  const res = await Promise.all(LGORDER.map(k => fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN[k]}/scoreboard?dates=${ymd(d)}`).then(r => r.ok ? r.json() : null).catch(() => null)));
  if (res.every(x => !x)) { $("live").innerHTML = '<div class="empty">Les scores en direct ne sont pas disponibles pour le moment. Vérifie ta connexion et réessaie dans quelques minutes.</div>'; return; }
  liveData = res; let anyLive = false;
  const blocks = LGORDER.map((k, i) => {
    const evs = (res[i] && res[i].events) || []; if (!evs.length) return "";
    const rows = evs.map(ev => {
      const c = ev.competitions && ev.competitions[0]; if (!c) return "";
      const st = (ev.status && ev.status.type) || {}, state = st.state;
      const on = state === "in"; if (on) anyLive = true;
      const h = c.competitors.find(x => x.homeAway === "home") || c.competitors[0], a = c.competitors.find(x => x.homeAway === "away") || c.competitors[1];
      const minute = on ? (ev.status.displayClock || st.shortDetail || "") : state === "post" ? "Terminé" : hFmt.format(new Date(ev.date));
      const sc = x => state === "pre" ? "" : esc(x.score);
      const win = x => state === "post" && x.winner;
      const team = x => `<div class="lteam ${win(x) ? "win" : ""}">${x.team.logo ? `<img src="${esc(x.team.logo)}" alt="" loading="lazy">` : ""}<span>${esc(x.team.shortDisplayName || x.team.displayName)}</span></div>`;
      return `<div class="lrow"><span class="lmin ${on ? "on" : ""}">${on ? '<span class="pulse"></span>' : ""}${esc(minute)}</span>
        <div class="lteams">${team(h)}${team(a)}</div>
        <div class="lscore ${on ? "on" : ""}"><span>${sc(h)}</span><span>${sc(a)}</span></div></div>`;
    }).join("");
    return `<div class="lgcard">${lgHead(k)}${rows}</div>`;
  }).join("");
  $("live").innerHTML = blocks ? `<div class="day">${blocks}</div>` : '<div class="empty">Aucun match des cinq grands championnats ce jour-là.</div>';
  $("liveDot").hidden = !(anyLive && liveOff === 0);
  $("liveUpd").textContent = "Actualisé à " + hFmt.format(new Date());
  if (view === "live") liveTimer = setTimeout(() => loadLive(false), anyLive ? 30000 : 120000);
}
async function liveBadge() { // point rouge sur l'onglet Live quand un match est en cours
  if (view === "live") return;
  const d = new Date();
  const res = await Promise.all(LGORDER.map(k => fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN[k]}/scoreboard?dates=${ymd(d)}`).then(r => r.ok ? r.json() : null).catch(() => null)));
  $("liveDot").hidden = !res.some(x => x && (x.events || []).some(e => e.status && e.status.type && e.status.type.state === "in"));
}

/* ---------- Combinés ---------- */
let combos = [];
function options(m) {
  const r = m.r, H = m.home.name, A = m.away.name;
  return [
    [r.p1, "1X2 : V1", "Victoire " + H],
    [r.p2, "1X2 : V2", "Victoire " + A],
    [r.p1 + r.px, "Double chance : 1X", H + " ou nul"],
    [r.p2 + r.px, "Double chance : X2", A + " ou nul"],
    [r.o25, "Total : Plus de 2.5", "Plus de 2,5 buts"],
    [1 - r.o25, "Total : Moins de 2.5", "Moins de 2,5 buts"],
    [r.btts, "Les deux équipes marquent : Oui", "Les deux équipes marquent"]
  ].filter(o => o[0] >= 0.5 && o[0] <= 0.92);
}
// Compose un combiné proche de la cote visée : n sélections dont la probabilité
// est la plus proche possible de la cible par sélection (cote visée ^ (1/n)).
function build(target, sizes) {
  const now = Date.now() + 10 * 60e3, up = matches.filter(m => m.date.getTime() > now);
  let best = null;
  for (const n of sizes) {
    const pStar = Math.pow(1 / target, 1 / n);
    const pool = up.map(m => {
      const o = options(m).filter(x => x[0] >= pStar - 0.04).sort((x, y) => Math.abs(x[0] - pStar) - Math.abs(y[0] - pStar))[0];
      return o ? { m, p: o[0], bk: o[1], label: o[2] } : null;
    }).filter(Boolean).sort((x, y) => (y.p - pStar >= 0 ? 0 : 1) - (x.p - pStar >= 0 ? 0 : 1) || Math.abs(x.p - pStar) - Math.abs(y.p - pStar));
    const legs = [];
    for (const c of pool) { if (legs.length >= n) break; if (legs.filter(l => l.m.league === c.m.league).length >= 2) continue; legs.push(c); }
    if (legs.length < n) continue;
    let odds = legs.reduce((s, l) => s / l.p, 1);
    // si la cote est un peu courte, on remplace la sélection la plus sûre par une plus audacieuse
    if (odds < target * 0.95) {
      const used = new Set(legs.map(l => l.m.id));
      const extra = up.filter(m => !used.has(m.id)).flatMap(m => options(m).map(o => ({ m, p: o[0], bk: o[1], label: o[2] })))
        .filter(c => c.p < pStar).sort((x, y) => y.p - x.p);
      legs.sort((x, y) => y.p - x.p);
      for (const c of extra) { const o2 = odds * legs[0].p / c.p; if (o2 >= target * 0.95) { legs[0] = c; odds = o2; break; } }
    }
    if (odds < target * 0.95 || odds > target * 1.6) continue;
    const cand = { legs: legs.sort((x, y) => x.m.date - y.m.date), odds, prob: legs.reduce((s, l) => s * l.p, 1) };
    if (!best || Math.abs(Math.log(cand.odds / target)) < Math.abs(Math.log(best.odds / target))) best = cand;
  }
  return best;
}
function ticketText(id) {
  const c = combos.find(x => x.id === id); if (!c) return "";
  return `Prono Lab · ${c.title} (cote estimée ${fmt(c.odds)})\n` + c.legs.map((l, i) =>
    `${i + 1}. ${l.m.home.name} - ${l.m.away.name} (${dayFmt.format(l.m.date).split(" ")[0]} ${hFmt.format(l.m.date)})\n   ${l.bk}`).join("\n");
}
function renderCombos() {
  const box = $("combos"); if (!box || !matches.length) return;
  combos = [];
  const safe = build(2, [3, 2, 4]), five = build(5, [4, 3, 5]);
  if (safe) combos.push({ id: "safe", title: "Combiné sûr", sub: "Les sélections les plus fiables", cls: "", ...safe });
  if (five) combos.push({ id: "five", title: "Combiné cote 5", sub: "Le coup à gros gain du week-end", cls: "big", ...five });
  if (!isMember()) {
    box.innerHTML = `<div class="combolock"><div class="blurred"><div></div><div></div><div></div></div>
      <h2>${combos.length} combinés prêts pour ce week-end</h2>
      <p class="msg">Un combiné sûr et un combiné cote 5, avec les libellés 1xBet et Melbet et la copie du ticket en un geste. Réservé aux membres.</p>
      <button class="cta" data-join>Devenir membre</button></div>`;
    return;
  }
  if (!combos.length) { box.innerHTML = '<div class="empty">Plus assez de matchs à venir ce week-end pour composer un combiné. Les prochains arrivent jeudi.</div>'; return; }
  box.innerHTML = combos.map(c => `<div class="combo">
    <div class="combohead ${c.cls}"><div><h3>${c.title}</h3><p>${c.sub} · ${c.legs.length} sélections</p></div>
      <div class="odds"><b>${fmt(c.odds)}</b><span>${pc(c.prob)} % de chances</span></div></div>
    ${c.legs.map(l => `<div class="leg"><span class="mt">${esc(l.m.home.name)} – ${esc(l.m.away.name)}</span>
      <span class="o">${fmt(1 / l.p)}<small>${pc(l.p)} %</small></span>
      <span class="mk">${esc(l.bk)} · ${LGS[l.m.league]} · ${dayFmt.format(l.m.date).split(" ")[0]} ${hFmt.format(l.m.date)}</span></div>`).join("")}
    <div class="combofoot"><span class="msg">Cote estimée par le modèle : chez 1xBet ou Melbet, elle sera un peu plus basse.</span>
      <button class="cta" data-ticket="${c.id}">Copier le ticket</button></div></div>`).join("")
    + `<p class="note">Un combiné ne passe que si toutes les sélections passent : un combiné cote 5 a environ 1 chance sur 5 de gagner. Mise uniquement ce que tu peux te permettre de perdre.</p>`;
}

/* ---------- Installation ---------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("installBtn").hidden = true; };
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

/* ---------- Présentation en 3 slides (première ouverture) ---------- */
(function intro() {
  let done = false; try { done = localStorage.getItem("pl_intro") === "1"; } catch (e) {}
  const box = $("intro"); if (done || !box) return;
  box.hidden = false; document.body.style.overflow = "hidden";
  const sl = $("slides"), dots = [...$("dots").children], next = $("introNext"), login = $("introLogin");
  const idx = () => Math.round(sl.scrollLeft / sl.clientWidth);
  const update = () => { const i = idx(); dots.forEach((d, k) => d.classList.toggle("on", k === i));
    const last = i === dots.length - 1; next.textContent = last ? "Créer mon compte" : "Suivant"; login.hidden = !last; };
  const close = tab => { try { localStorage.setItem("pl_intro", "1"); } catch (e) {} box.hidden = true; document.body.style.overflow = "";
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
liveBadge(); setInterval(liveBadge, 120000);
