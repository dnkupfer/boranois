// Prints a new host code (and its sign-up link) for whoever will start a group.
import { createStore } from "./store/index.js";

const { store } = createStore();
const code = await store.createHostCode();
const origin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
console.log(`Host code: ${code}\nLink: ${origin}/entrar?codigo=${code}`);
process.exit(0);
