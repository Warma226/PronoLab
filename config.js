// Réglages de Prono Lab.
// FIREBASE : à remplacer par la configuration de ton projet Firebase
// (Console Firebase > Paramètres du projet > Vos applications > Configuration du SDK).
window.PL_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCohT783Cp1eYUo_RdUJk4jDprYPCaadeY",
    authDomain: "pronolab-c4e46.firebaseapp.com",
    projectId: "pronolab-c4e46",
    storageBucket: "pronolab-c4e46.firebasestorage.app",
    messagingSenderId: "386285871325",
    appId: "1:386285871325:web:5897f406420fe8b9aa7b34"
  },
  // Numéro de l'administrateur (chiffres uniquement, avec l'indicatif 226).
  adminPhone: "22656286557",
  // Canal Telegram des membres (le lien enregistré dans « Gestion des membres » est prioritaire)
  telegram: "https://t.me/pronolabofficial",
  plans: {
    week:  { label: "Hebdo",   price: 1000, days: 7,  per: "semaine" },
    month: { label: "Mensuel", price: 3000, days: 30, per: "mois" }
  }
};
