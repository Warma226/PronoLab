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
  let list = matches.filter(m => filter === "ALL" || m.league === filter);
  if (sort === "conf") { list.sort((x, y) => y.r.conf - x.r.conf); $("list").innerHTML = '<div class="day">' + list.map(card).join("") + "</div>"; }
  else {
    list.sort((x, y) => x.date - y.date); const g = {};
    list.forEach(m => { const k = dayFmt.format(m.date); (g[k] = g[k] || []).push(m); });
    $("list").innerHTML = Object.entries(g).map(([k, v]) => `<div class="day"><h3>${k}</h3>${v.map(card).join("")}</div>`).join("") || '<div class="empty">Aucun match pour ce filtre.</div>';
  }
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
    $("sub").textContent = matches.length + " matchs des cinq grands championnats européens, analysés automatiquement. Touche un match pour voir le détail.";
    chips(); render();
  } catch (e) {
    $("list").innerHTML = '<div class="empty">Les matchs n\'ont pas pu être chargés. Vérifie ta connexion internet puis rouvre l\'app.</div>';
  }
}

/* ---------- Compte ---------- */
function renderTop() {
  const b = $("accBtn");
  if (me) { b.hidden = false; b.textContent = (myAcc && myAcc.name ? myAcc.name + " · " : "") + "Se déconnecter"; }
  else if (fs) { b.hidden = false; b.textContent = "Se connecter"; }
  else b.hidden = true;
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
function renderClub() {
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
function renderAll() { renderTop(); renderWelcome(); renderClub(); renderAdmin(); render(); }

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
  if (t.closest("[data-join]")) { $("club").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (t.closest("#tabCreate")) { authTab = "create"; renderWelcome(); return; }
  if (t.closest("#tabLogin")) { authTab = "login"; renderWelcome(); return; }
  if (t.closest("#accBtn")) {
    if (me) { await auth.signOut(); skipped = false; }
    else { skipped = false; authTab = "login"; renderWelcome(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }
  if (t.closest("#openAcc")) { skipped = false; try { localStorage.removeItem("pl_skip"); } catch (err) {} authTab = "create"; renderWelcome(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  if (t.closest("#skipBtn")) { skipped = true; if (!asVisitor) { try { localStorage.setItem("pl_skip", "1"); } catch (err) {} } renderWelcome(); return; }
  if (t.closest("#visitBtn")) { asVisitor = true; skipped = false; authTab = "create"; renderAll(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
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
    if (tab) { authTab = tab; skipped = false; try { localStorage.removeItem("pl_skip"); } catch (e) {} renderWelcome(); window.scrollTo(0, 0); } };
  sl.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  window.addEventListener("resize", update);
  next.onclick = () => { const i = idx(); if (i < dots.length - 1) sl.scrollTo({ left: (i + 1) * sl.clientWidth, behavior: "smooth" }); else close("create"); };
  login.onclick = () => close("login");
  $("introSkip").onclick = () => close(null);
})();

loadMatches();
initFirebase();
