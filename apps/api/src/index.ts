import { Resend } from "resend";
import { createApp } from "./app.js";
import { loadCatalogue } from "./catalogue.js";
import { createPhraser } from "./gemini.js";
import { createStore } from "./store/index.js";

const { store, kind } = createStore();
const catalogue = loadCatalogue();
const phraser = createPhraser();
const port = Number(process.env.PORT ?? 8080);

// Magic links are e-mailed only when Resend is configured; otherwise they're logged and the UI hides the option.
const resendKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const sendEmail =
  resendKey && emailFrom
    ? async (to: string, link: string) => {
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
          from: emailFrom,
          to,
          subject: "Seu link de acesso ao Boranois",
          text: `Para entrar no Boranois, abra este link (vale 30 minutos, uma vez):\n\n${link}\n\nSe você não pediu este e-mail, ignore.`,
        });
        if (error) throw new Error(`resend: ${error.message}`);
      }
    : undefined;

createApp({
  store,
  catalogue,
  phraser,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  adminToken: process.env.ADMIN_TOKEN,
  sendEmail,
}).listen(port, () => {
  console.log(
    `API on :${port} (store: ${kind}, ai: ${phraser.available ? "gemini" : "off — templates only"}, email: ${sendEmail ? "resend" : "off (links logged)"}, catalogue ${catalogue.version}: ${catalogue.personas.length} personas, ${catalogue.facts.length} verified facts)`,
  );
});
