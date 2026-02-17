import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCoKvqf6WZEhQCatisiLVN1_zupJZgxzeM",
  authDomain: "projektwoche-kinderrechte.firebaseapp.com",
  databaseURL: "https://projektwoche-kinderrechte-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "projektwoche-kinderrechte",
  storageBucket: "projektwoche-kinderrechte.firebasestorage.app",
  messagingSenderId: "538570251008",
  appId: "1:538570251008:web:da37ff76967ce95c4a71e5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
