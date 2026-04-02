// ─────────────────────────────────────────────
//  REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD0XeO1FQ6ba4K3LdglLsCqb3SOZUOHjOc",
  authDomain: "geogrid-bcf97.firebaseapp.com",
  projectId: "geogrid-bcf97",
  storageBucket: "geogrid-bcf97.firebasestorage.app",
  messagingSenderId: "697742751550",
  appId: "1:697742751550:web:5eb2f61caeb57b60585e6f",
  measurementId: "G-HZG6KKVK7Y"
};
firebase.initializeApp(FIREBASE_CONFIG);
window.db   = firebase.firestore();
window.auth = firebase.auth();
