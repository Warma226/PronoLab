/* Prono Lab — version anglaise (FR / EN).
   L'app est écrite en français ; en anglais, chaque texte affiché est traduit à la volée
   grâce au dictionnaire EN (phrases exactes) et aux règles RULES (phrases avec des valeurs).
   Pour corriger ou compléter une traduction : modifier EN ou RULES ci-dessous. */
(function () {
  let lang = "fr";
  try { lang = localStorage.getItem("pl_lang") || (/^en/i.test(navigator.language || "") ? "en" : "fr"); } catch (e) {}
  if (lang !== "en") lang = "fr";
  window.PL_LANG = lang;
  window.PL_LOCALE = lang === "en" ? "en-GB" : "fr-FR";

  /* ---------- Phrases exactes ---------- */
  const EN = {
    // Navigation, en-tête, filtres
    "Matchs": "Matches", "Coupons": "Slips", "Aide": "Help", "Compte": "Account", "Foot": "Football",
    "Installer": "Install", "Navigation": "Navigation", "Jour": "Day", "Championnat": "League", "Tri": "Sort",
    "Activer le mode nuit": "Switch to dark mode", "Activer le mode jour": "Switch to light mode",
    "Les plus sûrs": "Safest picks", "Par horaire": "By time", "Par confiance": "By confidence", "Tous": "All",
    "Chargement des matchs du week-end…": "Loading this weekend's matches…",
    "18+ · Les pronostics sont des estimations et ne garantissent aucun gain. Joue de façon responsable.":
      "18+ · Predictions are estimates and guarantee no winnings. Play responsibly.",
    "Matchs en cours": "Live matches", "Chargement des scores…": "Loading scores…", "Coupons du jour": "Today's slips",
    "Auj.": "Today", "Dem.": "Tmrw", "Hier": "Yesterday", "Aujourd'hui": "Today",
    // Pays
    "Amérique du Nord": "North America", "Russie": "Russia", "Suède": "Sweden", "Finlande": "Finland", "Suisse": "Switzerland",
    "Allemagne": "Germany", "Angleterre": "England", "Espagne": "Spain", "Italie": "Italy",
    // Cartes de match
    "En direct": "Live", "Fin": "FT", "Match nul": "Draw", "Fort": "Strong", "Moyen": "Medium", "Risqué": "Risky",
    "Les 5 coups sûrs": "The 5 safest picks", "Devenir membre": "Become a member",
    "Bilan de la période": "Results for this period",
    "Sans abonnement, tu vois le programme du jour. Les membres ont les pronos jusqu'à 3 jours à l'avance, les coupons du jour et l'accès au canal Telegram privé.":
      "Without a subscription, you see today's schedule. Members get predictions up to 3 days ahead, the daily slips and access to the private Telegram channel.",
    "Aucun match pour ce filtre.": "No matches for this filter.",
    "Buts attendus, scores probables et marchés : réservé aux membres.": "Expected goals, likely scores and markets: members only.",
    "Aucun match de hockey programmé pour le moment. Le programme est actualisé chaque matin.":
      "No hockey matches scheduled yet. The schedule is updated every morning.",
    "Aucun match programmé pour le moment. Le programme est actualisé chaque semaine.":
      "No matches scheduled yet. The schedule is updated every week.",
    "Les matchs n'ont pas pu être chargés. Vérifie ta connexion internet puis rouvre l'app.":
      "Matches could not be loaded. Check your internet connection, then reopen the app.",
    // Compte : connexion et inscription
    "Mon compte": "My account", "Se connecter": "Log in", "Me connecter": "Log me in", "Créer un compte": "Create an account",
    "Créer mon compte": "Create my account", "Terminer mon profil": "Finish my profile", "Terminer mon compte": "Finish my account",
    "Bienvenue sur Prono Lab": "Welcome to Prono Lab", "Content de te revoir": "Good to see you again",
    "Il manque juste ton prénom pour terminer ton compte.": "We just need your first name to finish your account.",
    "Crée ton compte en quelques secondes pour suivre les pronos chaque week-end et t'abonner aux coups sûrs.":
      "Create your account in seconds to follow the tips every weekend and subscribe to the safest picks.",
    "Connecte-toi avec ton numéro de téléphone et ton mot de passe.": "Log in with your phone number and password.",
    "Prénom ou pseudo": "First name or nickname", "Numéro de téléphone": "Phone number",
    "Mot de passe (6 caractères minimum)": "Password (at least 6 characters)", "Ville (facultatif)": "City (optional)",
    "Code parrain (facultatif)": "Referral code (optional)", "ex. 70 00 00 00": "e.g. 70 00 00 00", "ex. Ouagadougou": "e.g. Ouagadougou",
    "numéro de l'ami qui t'invite": "number of the friend who invited you", "Mot de passe oublié ?": "Forgot your password?",
    "Continuer sans compte": "Continue without an account",
    "Ce numéro a déjà un compte. Touche « Se connecter ».": "This number already has an account. Tap “Log in”.",
    "Numéro ou mot de passe incorrect.": "Wrong number or password.",
    "Aucun compte avec ce numéro. Touche « Créer un compte ».": "No account with this number. Tap “Create an account”.",
    "Le mot de passe doit contenir au moins 6 caractères.": "The password must be at least 6 characters long.",
    "Trop d'essais. Patiente quelques minutes puis réessaie.": "Too many attempts. Wait a few minutes, then try again.",
    "Pas de connexion internet. Vérifie ton réseau et réessaie.": "No internet connection. Check your network and try again.",
    "Ce numéro de téléphone n'est pas valide.": "This phone number is not valid.",
    "Le service ne répond pas. Vérifie ta connexion et réessaie.": "The service is not responding. Check your connection and try again.",
    "Une erreur est survenue. Vérifie ta connexion et réessaie.": "Something went wrong. Check your connection and try again.",
    "Indique ton prénom ou un pseudo.": "Enter your first name or a nickname.",
    "Indique un numéro de téléphone complet.": "Enter a full phone number.",
    "Création du compte…": "Creating your account…", "Connexion…": "Logging in…", "Envoi…": "Sending…",
    // Abonnement
    "Hebdo": "Weekly", "Mensuel": "Monthly", "hebdo": "weekly", "mensuel": "monthly",
    "F CFA / semaine": "F CFA / week", "Formule": "Plan",
    "Pronos jusqu'à 3 jours à l'avance": "Predictions up to 3 days ahead", "Coups sûrs et coupons du jour": "Safest picks and daily slips",
    "Analyse complète de chaque match": "Full analysis of every match", "Canal Telegram privé des membres": "Private members' Telegram channel",
    "Ta dernière demande n'a pas pu être validée : le paiement n'a pas été retrouvé. Vérifie la référence et renvoie une demande.":
      "Your last request could not be approved: the payment was not found. Check the reference and send a new request.",
    "Choisis ta formule": "Choose your plan", "Envoie le montant": "Send the amount", "Confirme ton paiement": "Confirm your payment",
    "Copier": "Copy", "Copié": "Copied",
    "Pour payer, contacte l'assistance WhatsApp dans l'onglet Aide.": "To pay, contact WhatsApp support in the Help tab.",
    "Moyen de paiement": "Payment method", "Numéro qui a payé": "Number that paid", "Référence de la transaction": "Transaction reference",
    "reçue par SMS": "received by SMS", "Renvoyer ma demande": "Resend my request", "Envoyer ma demande": "Send my request",
    "Indique le numéro qui a payé et la référence reçue par SMS.": "Enter the number that paid and the reference received by SMS.",
    "Demande envoyée. Ton accès sera activé après vérification du paiement.": "Request sent. Your access will be activated once the payment is verified.",
    "La demande n'est pas partie. Vérifie ta connexion et réessaie.": "The request was not sent. Check your connection and try again.",
    // Espace membre
    "Espace membre": "Members' area",
    "L'espace membre est momentanément indisponible. Vérifie ta connexion puis rouvre l'application.":
      "The members' area is temporarily unavailable. Check your connection, then reopen the app.",
    "Espace administrateur": "Admin area",
    "Tu vois tout le contenu débloqué. Les demandes d'abonnement et d'échange de points s'affichent plus bas, dans « Gestion des membres ».":
      "You can see all unlocked content. Subscription and points-exchange requests appear below, under “Member management”.",
    "Se déconnecter": "Log out", "Deviens membre": "Become a member", "Abonnement actif": "Active subscription", "jour": "day", "jours": "days",
    "Ton abonnement se termine bientôt : prolonge-le pour ne rater aucun coupon.": "Your subscription ends soon: extend it so you don't miss a single slip.",
    "Rejoindre le canal Telegram des membres": "Join the members' Telegram channel",
    "Le lien du canal Telegram t'est communiqué par l'assistance WhatsApp.": "WhatsApp support will send you the Telegram channel link.",
    "Prolonger": "Extend", "Les jours achetés s'ajoutent à ceux qui restent.": "The days you buy are added to the ones you have left.",
    "Prolonger mon abonnement": "Extend my subscription", "Ton abonnement a expiré": "Your subscription has expired",
    "Débloque les pronos sur 3 jours, les coups sûrs, les coupons du jour, l'analyse complète de chaque match et le canal Telegram privé.":
      "Unlock 3-day predictions, the safest picks, the daily slips, the full analysis of every match and the private Telegram channel.",
    // Fidélité
    "Programme fidélité": "Loyalty programme", "Bronze": "Bronze", "Argent": "Silver", "Or": "Gold", "niveau maximum": "top level",
    "Tu peux échanger tes points contre une semaine offerte.": "You can exchange your points for a free week.",
    "Échange en cours de validation": "Exchange awaiting approval", "abonnement Hebdo": "Weekly subscription",
    "abonnement Mensuel": "Monthly subscription", "par ami parrainé": "per referred friend", "Ton code parrain": "Your referral code",
    "Inviter un ami sur WhatsApp": "Invite a friend on WhatsApp", "Les niveaux": "Levels", "dès l'inscription": "from sign-up",
    "Historique": "History", "Points insuffisants": "Not enough points", "Échec, réessaie": "Failed, try again", "Échec, réessayer": "Failed, try again",
    // Paramètres
    "Paramètres": "Settings", "Mon profil": "My profile", "Ville": "City", "Enregistrer": "Save",
    "Changer de mot de passe": "Change password", "Mot de passe actuel": "Current password",
    "Nouveau mot de passe (6 caractères minimum)": "New password (at least 6 characters)", "Changer le mot de passe": "Change the password",
    "Profil enregistré.": "Profile saved.", "Enregistrement impossible. Réessaie.": "Could not save. Try again.",
    "Le nouveau mot de passe doit contenir au moins 6 caractères.": "The new password must be at least 6 characters long.",
    "Mot de passe changé.": "Password changed.", "Le mot de passe actuel est incorrect.": "The current password is wrong.",
    "Changement impossible. Réessaie.": "Could not change it. Try again.",
    // Administration
    "Gestion des membres": "Member management", "Tes numéros de paiement (affichés aux visiteurs)": "Your payment numbers (shown to visitors)",
    "Lien du canal Telegram des membres": "Members' Telegram channel link", "Enregistrer les numéros": "Save the numbers",
    "Demandes en attente": "Pending requests", "Membres actifs": "Active members",
    "Abonnements expirés (à retirer du canal Telegram)": "Expired subscriptions (to remove from the Telegram channel)",
    "Client": "Customer", "échange de points": "points exchange", "Refuser": "Decline",
    "Aucune demande pour le moment.": "No requests yet.", "Aucun abonnement expiré ces 30 derniers jours.": "No subscriptions expired in the last 30 days.",
    "Aucun membre actif.": "No active members.", "Le lien Telegram doit commencer par https://t.me/": "The Telegram link must start with https://t.me/",
    "Numéros enregistrés.": "Numbers saved.",
    // Live et page d'un match en direct
    "‹ Retour": "‹ Back", "Chargement du match…": "Loading the match…", "Recherche des matchs en cours…": "Looking for live matches…",
    "Aucun match en cours pour le moment.": "No live matches right now.",
    "Les matchs apparaîtront ici dès le coup d'envoi.": "Matches will appear here as soon as they kick off.",
    "Direct disponible pour la NHL. KHL et ligues européennes : résultats ajoutés chaque matin.":
      "Live coverage available for the NHL. KHL and European leagues: results added every morning.",
    "Mi-temps": "Half-time", "Terminé": "Full time", "Terminé (prol.)": "Final (OT)", "Terminé (TAB)": "Final (SO)",
    "Aperçu 2D": "2D view", "compositions et événements": "line-ups and events",
    "Compositions des deux équipes sur le terrain": "Both teams' line-ups on the pitch",
    "⚽ but": "⚽ goal", "🟨🟥 carton": "🟨🟥 card", "🔼🔽 changement": "🔼🔽 substitution",
    "Notre prono": "Our tip", "Voir l'analyse du match ›": "See the match analysis ›",
    "Les compositions d'équipe ne sont pas encore disponibles pour ce match.": "Line-ups are not available yet for this match.",
    "Buts et pénalités": "Goals and penalties", "Événements du match": "Match events", "Statistiques": "Statistics",
    "Aucun événement pour le moment.": "No events yet.", "Ce match n'a pas pu être chargé. Vérifie ta connexion.": "This match could not be loaded. Check your connection.",
    "Possession": "Possession", "Tirs": "Shots", "Tirs cadrés": "Shots on target", "Corners": "Corners", "Fautes": "Fouls",
    "Cartons jaunes": "Yellow cards", "Cartons rouges": "Red cards", "Hors-jeu": "Offsides", "Arrêts": "Saves",
    // Page de détail d'un match
    "Match introuvable. Il ne fait peut-être plus partie de la sélection de la semaine.": "Match not found. It may no longer be part of this week's selection.",
    "✓ Gagné": "✓ Won", "✗ Perdu": "✗ Lost", "En cours": "In progress", "⚽ But": "⚽ Goal",
    "Analyse détaillée": "Detailed analysis", "Buts attendus": "Expected goals", "Victoire prol. incluse 1 / 2": "Win incl. OT 1 / 2",
    "Nul après 60 min (prolongation)": "Draw after 60 min (overtime)", "Plus / moins de 5,5 buts": "Over / under 5.5 goals",
    "Cote juste vainqueur 1 / 2": "Fair odds, winner 1 / 2", "Scores les plus probables (60 min)": "Most likely scores (60 min)",
    "Plus de 2,5 buts": "Over 2.5 goals", "Moins de 2,5 buts": "Under 2.5 goals", "Plus de 5,5 buts": "Over 5.5 goals", "Moins de 5,5 buts": "Under 5.5 goals",
    "Les deux équipes marquent": "Both teams to score", "Double chance 1X / X2": "Double chance 1X / X2", "Cote juste 1 / N / 2": "Fair odds 1 / X / 2",
    "Scores les plus probables": "Most likely scores", "Analyse détaillée réservée aux membres": "Detailed analysis for members only",
    "Buts attendus, plus/moins de 2,5 buts, les deux équipes marquent, scores les plus probables et cotes justes.":
      "Expected goals, over/under 2.5 goals, both teams to score, most likely scores and fair odds.",
    "Domicile": "Home", "Extérieur": "Away", "Forme (5 derniers matchs)": "Form (last 5 matches)", "Saison en cours": "Current season",
    "Matchs joués": "Matches played", "Buts marqués": "Goals scored", "Buts encaissés": "Goals conceded",
    // Coupons
    "Coupon sûr": "Safe slip", "Coupon cote 5": "Odds-5 slip", "Les sélections les plus fiables du jour": "The day's most reliable picks",
    "Le coup à gros gain du jour": "The day's big-win shot", "Les deux équipes marquent : Oui": "Both teams to score: Yes",
    "Pas assez de matchs ce jour-là pour composer un coupon fiable.": "Not enough matches that day to build a reliable slip.",
    "Aucun match de hockey suivi ce jour-là.": "No tracked hockey matches that day.",
    "Aucun match des cinq grands championnats ce jour-là.": "No matches in the big five leagues that day.",
    "Un coupon sûr et un coupon cote 5, avec les libellés 1xBet et Melbet et la copie du ticket en un geste. Réservé aux membres.":
      "A safe slip and an odds-5 slip, with 1xBet and Melbet labels and one-tap ticket copy. Members only.",
    "✓ Coupon gagné": "✓ Slip won", "✗ Coupon perdu": "✗ Slip lost",
    "Cote estimée par le modèle : chez 1xBet ou Melbet, elle sera un peu plus basse.": "Odds estimated by the model: at 1xBet or Melbet they will be slightly lower.",
    "Copier le ticket": "Copy the ticket", "Ticket copié": "Ticket copied", "Copie impossible": "Copy failed",
    "Un coupon ne passe que si toutes les sélections passent : un coupon cote 5 a environ 1 chance sur 5 de gagner. Mise uniquement ce que tu peux te permettre de perdre.":
      "A slip only wins if every pick wins: an odds-5 slip has about a 1 in 5 chance of winning. Only bet what you can afford to lose.",
    // Aide
    "Assistance": "Support", "Une question sur un paiement, ton compte ou un prono ? Notre équipe te répond sur WhatsApp.":
      "A question about a payment, your account or a tip? Our team answers you on WhatsApp.",
    "Écrire sur WhatsApp": "Message us on WhatsApp", "Numéro": "Number", "Conditions d'utilisation": "Terms of use", "Questions fréquentes": "FAQ",
    "Bonjour, j'ai une question sur Prono Lab : ": "Hello, I have a question about Prono Lab: ",
    "Comment sont calculés les pronos ?": "How are the predictions calculated?",
    "L'app compare les buts marqués et encaissés de chaque équipe à la moyenne de son championnat, ajoute l'avantage du terrain et la forme récente, puis calcule les probabilités avec un modèle statistique. Fort = 60 % et plus, Moyen = 45 à 60 %, Risqué = moins de 45 %.":
      "The app compares each team's goals scored and conceded with its league average, adds home advantage and recent form, then calculates the probabilities with a statistical model. Strong = 60% or more, Medium = 45 to 60%, Risky = under 45%.",
    "Comment devenir membre ?": "How do I become a member?",
    "Onglet Compte : crée ton compte, choisis Hebdo (1000 F CFA) ou Mensuel (3000 F CFA), paie par Orange Money, Moov Money ou Wave, puis envoie la référence de la transaction.":
      "Account tab: create your account, choose Weekly (1,000 F CFA) or Monthly (3,000 F CFA), pay with Orange Money, Moov Money or Wave, then send the transaction reference.",
    "Quand mon abonnement est-il activé ?": "When is my subscription activated?",
    "Dès que le paiement est vérifié, en général dans la journée. Si c'est long, écris-nous sur WhatsApp avec ta référence.":
      "As soon as the payment is verified, usually within the day. If it takes long, message us on WhatsApp with your reference.",
    "Quand changent les coupons ?": "When do the slips change?",
    "Chaque jour à 00h GMT, à partir des matchs du jour. Après les matchs, chaque sélection affiche ✓ (gagnée) ou ✗ (perdue).":
      "Every day at 00:00 GMT, based on that day's matches. After the matches, each pick shows ✓ (won) or ✗ (lost).",
    "Les pronos sont-ils garantis ?": "Are the predictions guaranteed?",
    "Non : ce sont des estimations, jamais des certitudes. Ne mise que ce que tu peux te permettre de perdre.":
      "No: they are estimates, never certainties. Only bet what you can afford to lose.",
    // Présentation (première ouverture)
    "Passer": "Skip", "Suivant": "Next", "J'ai déjà un compte": "I already have an account",
    "Les pronos du week-end, prêts à l'avance": "Weekend predictions, ready in advance",
    "Premier League, Liga, Serie A, Bundesliga et Ligue 1 : tous les matchs analysés chaque semaine, sans rien à faire.":
      "Premier League, Liga, Serie A, Bundesliga and Ligue 1: every match analysed each week, with nothing for you to do.",
    "Des chiffres, pas des intuitions": "Numbers, not hunches",
    "Probabilités 1 / N / 2, scores les plus probables et niveau de confiance pour chaque affiche.":
      "1 / X / 2 probabilities, most likely scores and a confidence level for every fixture.",
    "Les coups sûrs, réservés aux membres": "The safest picks, for members only",
    "1000 F CFA la semaine ou 3000 F CFA le mois, payables par Orange Money, Moov Money ou Wave.":
      "1,000 F CFA a week or 3,000 F CFA a month, payable with Orange Money, Moov Money or Wave.",
    // Conditions d'utilisation
    "Fermer": "Close", "Version du 30 octobre 2026": "Version of 30 October 2026",
    "1. Le service": "1. The service",
    "Prono Lab propose des pronostics sportifs (football et hockey sur glace) calculés par un modèle statistique, à titre d'information. Prono Lab n'est pas un site de paris : aucun pari n'est pris ni encaissé dans l'application.":
      "Prono Lab provides sports predictions (football and ice hockey) calculated by a statistical model, for information purposes. Prono Lab is not a betting site: no bets are taken or collected in the app.",
    "2. Âge minimum": "2. Minimum age", "L'application est réservée aux personnes de 18 ans ou plus.": "The app is restricted to people aged 18 or over.",
    "3. Aucune garantie de gain": "3. No guarantee of winnings",
    "Les pronostics, coupons et probabilités sont des estimations. Aucun résultat n'est garanti. Prono Lab ne peut être tenu responsable des sommes misées ou perdues auprès des bookmakers. Les cotes affichées sont indicatives et peuvent différer de celles des bookmakers.":
      "Predictions, slips and probabilities are estimates. No result is guaranteed. Prono Lab cannot be held liable for any sums staked or lost with bookmakers. The odds shown are indicative and may differ from the bookmakers' odds.",
    "4. Compte": "4. Account",
    "Ton compte est personnel et ne doit pas être partagé. Tu es responsable de la confidentialité de ton mot de passe et de l'exactitude des informations fournies.":
      "Your account is personal and must not be shared. You are responsible for keeping your password confidential and for the accuracy of the information you provide.",
    "5. Abonnements": "5. Subscriptions",
    "Hebdo : 1 000 F CFA pour 7 jours. Mensuel : 3 000 F CFA pour 30 jours. Paiement par Orange Money, Moov Money ou Wave ; l'accès est activé après vérification du paiement. L'abonnement donne accès aux pronostics jusqu'à 3 jours à l'avance, aux coups sûrs, aux coupons du jour, aux analyses détaillées et au canal Telegram des membres. Il n'est pas renouvelé automatiquement. Un abonnement activé n'est pas remboursable, sauf erreur de notre part.":
      "Weekly: 1,000 F CFA for 7 days. Monthly: 3,000 F CFA for 30 days. Payment by Orange Money, Moov Money or Wave; access is activated once the payment is verified. The subscription gives access to predictions up to 3 days ahead, the safest picks, the daily slips, detailed analyses and the members' Telegram channel. It does not renew automatically. An activated subscription is non-refundable, unless the error is ours.",
    "6. Canal Telegram": "6. Telegram channel",
    "L'accès au canal Telegram est lié à un abonnement actif. À l'expiration de l'abonnement, le membre peut en être retiré.":
      "Access to the Telegram channel is tied to an active subscription. When the subscription expires, the member may be removed from it.",
    "7. Programme de fidélité": "7. Loyalty programme",
    "Les points de fidélité n'ont aucune valeur monétaire et ne peuvent pas être échangés contre de l'argent. Les règles du programme peuvent évoluer.":
      "Loyalty points have no monetary value and cannot be exchanged for money. The programme rules may change.",
    "8. Utilisation du contenu": "8. Use of the content",
    "Les pronostics et coupons sont réservés à un usage personnel. Leur revente ou leur diffusion publique est interdite et peut entraîner la suspension du compte, sans remboursement.":
      "Predictions and slips are for personal use only. Reselling or publicly sharing them is prohibited and may lead to the account being suspended, without a refund.",
    "9. Données personnelles": "9. Personal data",
    "Nous conservons ton prénom, ton numéro de téléphone, ta ville et l'historique de tes abonnements, uniquement pour faire fonctionner le service. Ces données sont hébergées par Google Firebase. Tu peux demander leur suppression à l'assistance WhatsApp.":
      "We keep your first name, phone number, city and subscription history solely to run the service. This data is hosted by Google Firebase. You can ask WhatsApp support to delete it.",
    "10. Jeu responsable": "10. Responsible gambling",
    "Ne mise que ce que tu peux te permettre de perdre. Fais une pause si le jeu n'est plus un plaisir, et parles-en à un proche si tu sens que tu perds le contrôle.":
      "Only bet what you can afford to lose. Take a break if betting is no longer fun, and talk to someone close to you if you feel you are losing control.",
    "11. Modifications et contact": "11. Changes and contact",
    "Ces conditions peuvent être mises à jour ; tu seras alors invité à les accepter de nouveau. Pour toute question : l'assistance WhatsApp, dans l'onglet Aide.":
      "These terms may be updated; you will then be asked to accept them again. For any question: WhatsApp support, in the Help tab.",
    "Je confirme avoir 18 ans ou plus": "I confirm I am 18 or over",
    "J'ai lu et j'accepte les conditions d'utilisation": "I have read and accept the terms of use",
    "Accepter et continuer": "Accept and continue", "Je refuse": "I decline",
    "Tu dois accepter les conditions d'utilisation et confirmer avoir 18 ans ou plus pour utiliser Prono Lab.":
      "You must accept the terms of use and confirm you are 18 or over to use Prono Lab."
  };

  /* ---------- Phrases avec des valeurs (noms d'équipes, dates, nombres…) ---------- */
  const MONTHS = { janvier: "January", février: "February", mars: "March", avril: "April", mai: "May", juin: "June", juillet: "July", août: "August",
    septembre: "September", octobre: "October", novembre: "November", décembre: "December",
    "janv.": "Jan", "févr.": "Feb", "avr.": "Apr", "juil.": "Jul", "sept.": "Sep", "oct.": "Oct", "nov.": "Nov", "déc.": "Dec" };
  const months = s => s.replace(/janv\.|févr\.|avr\.|juil\.|sept\.|oct\.|nov\.|déc\.|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/g, m => MONTHS[m]);
  const pk = c => c.replace(/N/g, "X");                 // code du prono : N (nul) devient X en anglais
  const FORM = { V: "W", N: "D", D: "L" };              // forme : Victoire / Nul / Défaite
  const pl = (n, one, many) => n + " " + (+n > 1 ? many : one);
  const RULES = [
    [/^(Fort|Moyen|Risqué) (\d+) %$/, (_, c, n) => EN[c] + " " + n + "%"],
    [/^(-?\d+(?:[.,]\d+)?) %$/, (_, n) => n + "%"],
    [/^(\d+) % de réussite$/, (_, n) => n + "% success rate"],
    [/^(\d+) % de chances$/, (_, n) => n + "% chance"],
    [/^Prono (1|N|2|1N|N2)$/, (_, c) => "Tip " + pk(c)],
    [/^(1|N|2|1N|N2)( [✓✗])?$/, (_, c, m) => pk(c) + (m || "")],
    [/^(1|N|2) · (\d+)( %)?$/, (_, c, n, p) => pk(c) + " · " + n + (p ? "%" : "")],
    [/^Forme : ([VND]*)$/, (_, f) => "Form: " + f.replace(/[VND]/g, x => FORM[x])],
    [/^Victoire (.+) \(prol\. incluse\)$/, (_, t) => t + " win (incl. OT)"],
    [/^Victoire (.+)$/, (_, t) => t + " win"],
    [/^(.+) ou nul après 60 min$/, (_, t) => t + " or draw after 60 min"],
    [/^(.+) ou nul$/, (_, t) => t + " or draw"],
    [/^✓ (\d+) gagnés?$/, (_, n) => "✓ " + n + " won"],
    [/^✗ (\d+) perdus?$/, (_, n) => "✗ " + n + " lost"],
    [/^(\d+) matchs? au programme (?:demain|le (.+))$/, (_, n, d) => pl(n, "match", "matches") + " scheduled " + (d ? "on " + d : "tomorrow")],
    [/^Ce match se joue (?:demain|le (.+))\. Son prono est réservé aux membres, qui voient le programme jusqu'à 3 jours à l'avance\.$/,
      (_, d) => "This match is played " + (d ? "on " + d : "tomorrow") + ". Its tip is for members only, who see the schedule up to 3 days ahead."],
    [/^Réservés aux membres · dès (.+) la semaine$/, (_, p) => "Members only · from " + p + " a week"],
    [/^(Période|Week-end) du ?(.*?) ?· mis à jour le (.+)$/, (_, k, w, d) => (k === "Période" ? "Period" : "Weekend") + (w ? " of " + months(w) : "") + " · updated " + months(d)],
    [/^Demande (\S+) envoyée le (.+) \(référence (.+)\)\. Ton accès sera activé dès que le paiement sera vérifié\.$/,
      (_, p, d, r) => T(p).replace(/^./, x => x.toUpperCase()) + " request sent on " + d + " (reference " + r + "). Your access will be activated as soon as the payment is verified."],
    [/^(.+) F d'économie$/, (_, n) => "Save " + n + " F"],
    [/^dès (.+) pts cumulés$/, (_, n) => "from " + n + " pts earned"],
    [/^dès (.+)$/, (_, n) => "from " + n],
    [/^Crée ton compte ou connecte-toi, puis choisis ta formule : (.+) la semaine ou (.+) le mois\. Chaque abonnement te rapporte des points fidélité\.$/,
      (_, w, m) => "Create your account or log in, then choose your plan: " + w + " a week or " + m + " a month. Every subscription earns you loyalty points."],
    [/^Formule (.+)$/, (_, p) => T(p) + " plan"],
    [/^jusqu'au (.+)$/, (_, d) => "until " + d],
    [/^fini le (.+)$/, (_, d) => "ended " + d],
    [/^(\d+) jours?$/, (_, n) => pl(n, "day", "days")],
    [/^Niveau (.+)$/, (_, l) => T(l) + " level"],
    [/^points ×(.+)$/, (_, x) => "points ×" + x.replace(",", ".")],
    [/^encore (.+) pts pour le niveau (.+)$/, (_, n, l) => n + " more pts to reach " + T(l)],
    [/^Encore (.+) pts pour une semaine offerte\.$/, (_, n) => n + " more pts for a free week."],
    [/^Échanger (\d+) pts contre (\d+) jours offerts$/, (_, p, d) => "Exchange " + p + " pts for " + d + " free days"],
    [/^Ton ami saisit ce code à l'inscription\. Dès son premier abonnement, tu gagnes (\d+) pts\.(?: Déjà (\d+) amis? parrainés?\.)?$/,
      (_, p, n) => "Your friend enters this code when signing up. As soon as they first subscribe, you earn " + p + " pts." + (n ? " Already " + pl(n, "friend", "friends") + " referred." : "")],
    [/^Abonnement (\S+)$/, (_, p) => T(p) + " subscription"],
    [/^(\d+) jours offerts$/, (_, n) => n + " free days"],
    [/^Parrainage de (.+)$/, (_, n) => "Referral: " + n],
    [/^(\d+) comptes?$/, (_, n) => pl(n, "account", "accounts")],
    [/^(\d+) membres? actifs?$/, (_, n) => pl(n, "active member", "active members")],
    [/^(.+) pts disponibles$/, (_, n) => n + " pts available"],
    [/^demande (\d+) jours offerts contre (\d+) pts$/, (_, d, p) => "requests " + d + " free days for " + p + " pts"],
    [/^Envoyée le (.+)$/, (_, d) => "Sent on " + d],
    [/^déjà membre jusqu'au (.+)$/, (_, d) => "already a member until " + d],
    [/^Offrir (\d+) jours$/, (_, n) => "Give " + n + " days"],
    [/^Valider (\d+) jours$/, (_, n) => "Approve " + n + " days"],
    [/^réf\. (.+)$/, (_, r) => "ref. " + r],
    [/^Compte : (.+)$/, (_, p) => "Account: " + p],
    [/^Parrainé par (.+) \(\+(\d+) pts pour lui à la validation\)$/, (_, n, p) => "Referred by " + n + " (+" + p + " pts for them on approval)"],
    [/^Mot de passe oublié \? Écris à l'administrateur sur WhatsApp au (\+\d+) pour le réinitialiser\.$/,
      (_, n) => "Forgot your password? Message the administrator on WhatsApp at " + n + " to reset it."],
    [/^Prochain (coup d'envoi|engagement) à (.+?) : (.*)\.$/, (_, k, h, m) => "Next " + (k === "engagement" ? "face-off" : "kick-off") + " at " + h + ": " + m + "."],
    [/^Actualisé à (.+)$/, (_, h) => "Updated at " + h],
    [/^(.*)\(csc\)(.*)$/, (_, a, b) => a + "(og)" + b],
    [/^(\d+)e · (.*)$/, (_, p, c) => "P" + p + " · " + c],
    [/^(\d) sur (\d)$/, (_, a, b) => a + " of " + b],
    // Libellés des paris (coupons)
    [/^1X2 : V([12])$/, (_, n) => "1X2: W" + n],
    [/^Double chance : (1X|X2)$/, (_, c) => "Double chance: " + c],
    [/^Total : (Plus|Moins) de (\d\.5)$/, (_, s, n) => "Total: " + (s === "Plus" ? "Over " : "Under ") + n],
    [/^Vainqueur \(prol\. incluse\) : ([12])$/, (_, n) => "Winner (incl. OT): " + n],
    [/^Double chance \(temps régl\.\) : (1X|X2)$/, (_, c) => "Double chance (reg. time): " + c],
    [/^Total \(prol\. incluse\) : (Plus|Moins) de (\d\.5)$/, (_, s, n) => "Total (incl. OT): " + (s === "Plus" ? "Over " : "Under ") + n],
    [/^Coupons du (.+)$/, (_, d) => "Slips for " + d],
    [/^prochains coupons dans (\d+) h (\d+) \(00h GMT\)$/, (_, h, m) => "next slips in " + h + " h " + m + " (00:00 GMT)"],
    [/^(.+?\.) Prochains coupons le (.+)\.$/, (_, a, d) => T(a) + " Next slips on " + d + "."],
    [/^(\d+) coupons? prêts? pour aujourd'hui$/, (_, n) => pl(n, "slip", "slips") + " ready for today"],
    [/^(\d+) sélections$/, (_, n) => n + " picks"],
    // Textes partagés (ticket copié, invitation WhatsApp)
    [/^Prono Lab · (.+) du (.+) \(cote estimée (.+)\)$/, (_, c, d, o) => "Prono Lab · " + T(c) + " for " + d + " (estimated odds " + o + ")"],
    [/^Je suis les pronos foot sur Prono Lab\. Inscris-toi avec mon code parrain (\S+) : (\S+)$/,
      (_, c, u) => "I follow football tips on Prono Lab. Sign up with my referral code " + c + ": " + u]
  ];

  // Chrono des matchs (ex. « Fin 1re », « 12:34 - Prol. »)
  const clock = s => EN[s] || s.replace(/^Fin\b/, "End of").replace(/\b1re\b/, "1st").replace(/\b2e\b/, "2nd").replace(/\b3e\b/, "3rd")
    .replace(/\bProl\./, "OT").replace(/\bTAB\b/, "SO").replace(/\bPause\b/, "Intermission");

  function trCore(c) {
    if (Object.prototype.hasOwnProperty.call(EN, c)) return EN[c];
    const dot = c.includes(" · ");                          // « A · B · C » : seules les règles prévues pour « · » s'appliquent à la phrase entière
    for (const [re, fn] of RULES) { if (dot && !re.source.includes("·")) continue; const m = c.match(re); if (m) return fn(...m); }
    if (dot) {                                             // sinon chaque morceau est traduit séparément
      const parts = c.split(" · "), out = parts.map(trCore);
      if (out.some(x => x != null)) return parts.map((p, i) => out[i] == null ? p : out[i]).join(" · ");
    }
    return null;
  }
  const T = s => { const r = trCore(s); return r == null ? s : r; };
  function tr(s, fn = trCore) {
    const core = String(s).trim().replace(/\s+/g, " ");
    if (!core) return s;
    const out = fn(core);
    return out == null || out === core ? s : String(s).match(/^\s*/)[0] + out + String(s).match(/\s*$/)[0];
  }
  window.PL_T = s => lang === "en" ? String(s).split("\n").map(l => tr(l)).join("\n") : s;

  /* ---------- Bouton de langue ---------- */
  function setupButtons() {
    document.querySelectorAll("[data-lang-toggle]").forEach(b => {
      b.textContent = lang === "en" ? "FR" : "EN";
      b.setAttribute("aria-label", lang === "en" ? "Passer en français" : "Switch to English");
      b.setAttribute("title", lang === "en" ? "Version française" : "English version");
    });
  }
  document.addEventListener("click", e => {
    if (!e.target.closest("[data-lang-toggle]")) return;
    try { localStorage.setItem("pl_lang", lang === "en" ? "fr" : "en"); } catch (err) {}
    location.reload();
  });
  setupButtons();
  if (lang !== "en") return;

  /* ---------- Traduction de la page ---------- */
  document.documentElement.lang = "en";
  const SKIP = "script,style,code,textarea,.tn,.pinfo b,[data-lang-toggle]";
  const ATTRS = ["placeholder", "aria-label", "title"];
  const done = new WeakMap();                              // texte déjà traduit : on n'y retouche pas
  function textNode(n) {
    const v = n.nodeValue;
    if (done.get(n) === v || !v.trim()) return;
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) return;
    let out;
    if (p.classList.contains("fc")) out = FORM[v.trim()] || v;
    else if (p.closest("[data-clock],.lmin,.dstate")) out = tr(v, s => trCore(s) || clock(s));
    else out = tr(v);
    if (out !== v) n.nodeValue = out;
    done.set(n, n.nodeValue);
  }
  function element(el) {
    if (el.closest(SKIP)) return;
    ATTRS.forEach(a => { const v = el.getAttribute(a); if (v) { const o = tr(v); if (o !== v) el.setAttribute(a, o); } });
  }
  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    element(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = it.nextNode(); n; n = it.nextNode()) n.nodeType === 3 ? textNode(n) : element(n);
  }
  walk(document.body);
  new MutationObserver(list => list.forEach(m => {
    if (m.type === "childList") m.addedNodes.forEach(walk);
    else if (m.type === "characterData") textNode(m.target);
    else if (m.type === "attributes") element(m.target);
  })).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
})();
