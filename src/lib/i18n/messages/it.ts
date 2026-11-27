/**
 * Base messages shared by the whole app. Keys in English, values in Italian.
 * Plain strings and plural forms only: no functions, no JSX, no data access.
 */

import type { MessageTree } from "./types";

export const it = {
  loading: "Caricamento in corso",
  close: "Chiudi",
  back: "Indietro",
  cancel: "Annulla",
  retry: "Riprova",
  // Basic components (#503)
  edit: "Modifica",
  showPassword: "Mostra la password",
  offlineLead: "Sei offline.",
  // Product name (#502): `{app}` is the name, `{nest}` is the home. The two
  // articles of «Il tuo {nest}» change here when the final name arrives.
  brand: {
    description: "{app} — l'organizer per la tua famiglia",
    yourNest: "Il tuo {nest}",
    yourNestLower: "il tuo {nest}",
    askNest: "Chiedi a {nest}",
    nestEnergy: "Energia di {nest}",
    titleSeparator: "·",
    enter: "Entra in {app}",
    createdWith: "Lista creata con {app}",
  },
  calendariCollegati: {
    intro: "Scegli quali calendari portare in {app} e cosa vedono gli altri.",
    unlinkWithCalendars:
      "Gli impegni di {names} spariscono da {app}. Su {provider} non cambia niente.",
    directionBoth:
      "Quello che crei su {provider} arriva qui, e puoi mandare su {provider} gli impegni di {app}.",
    directionIncoming:
      "Vedi i tuoi impegni{work}, ma {app} non scrive su {provider}.",
    adminApproval:
      "Il tuo account di lavoro non permette di collegare app esterne a {name}. Chiedi a chi gestisce gli account in ufficio di approvare {app}, oppure collega un altro calendario.",
    notConfigured:
      "Per ora non è possibile collegare Google o Outlook: il servizio non è ancora attivo su {app}. Intanto puoi aggiungere gli impegni a mano.",
    outlookUnlinked:
      "{app} non può più usare il tuo account <b>Outlook</b>. Se vuoi, togli il permesso anche dalla pagina Microsoft delle app con accesso al tuo account.",
  },
  memberSheet: {
    accountIsAdult: "Chi usa {app} con il suo account è sempre un adulto.",
  },
  aggiungi: {
    alsoOnReadFailed:
      "Non riusciamo a caricare i tuoi calendari collegati: per ora l'impegno resta solo in {app}. Controlla la connessione e riprova.",
    alsoOnLeft:
      "Se chiudi, l'impegno resta solo in {app}. Puoi mandarlo a {provider} più tardi, da «Modifica» nel dettaglio dell'impegno.",
  },
  onboarding: {
    adminApproval:
      "Il tuo account di lavoro non permette di collegare app esterne a {name}. Chiedi a chi gestisce gli account in ufficio di approvare {app}, oppure collega un altro calendario.",
    createFailedNetwork:
      "Non siamo riusciti a creare il tuo {nest}. Controlla la connessione e riprova.",
    createFailedServer:
      "Non siamo riusciti a creare il tuo {nest} per un problema nostro. Riprova tra qualche minuto.",
  },
  profilo: {
    signOutTitle: "Uscire da {app}?",
  },
  invito: {
    expiredText:
      "Chiedi a chi ti ha mandato il link di invitarti di nuovo: dal suo {app} bastano due tocchi.",
  },
  accesso: {
    checkMail:
      "Se è un indirizzo nuovo, ti abbiamo mandato una mail a <b>{email}</b>. Apri il link che contiene: entri subito in {app}.",
    confirmLead: "Tocca il bottone per confermare la mail ed entrare in {app}.",
    forgotSent:
      "Se <b>{email}</b> è la mail di un account {app}, ti è arrivato un link per scegliere una nuova password.",
    termsSoon:
      "Qui leggerai le regole per usare {app}. Stiamo preparando questa pagina.",
    privacySoon:
      "Qui leggerai quali dati raccoglie {app}, perché e come li proteggiamo. Stiamo preparando questa pagina.",
  },
  fornitoreFinto: {
    request:
      "{app} chiede di leggere i tuoi calendari e di scrivere i loro impegni.",
  },
  memberColors: {
    pomodoro: "Corallo",
    glicine: "Glicine",
    salvia: "Menta",
    cobalto: "Blu",
    zafferano: "Ambra",
    lampone: "Sabbia",
    ceruleo: "Azzurro",
    peonia: "Rosa",
    basilico: "Ardesia",
    cannella: "Cannella",
  },
  // Choices and people components (F4b, #504). A group of its own, to keep
  // away from the open notification work that also edits this file.
  choicesPeople: {
    chooseOne: "Scegli una risposta.",
    add: "Aggiungi",
    touched: "Hai toccato: {name}",
    more: "+{count}",
    days: "Giorni",
    weekdays: {
      mon: { short: "Lun", full: "lunedì" },
      tue: { short: "Mar", full: "martedì" },
      wed: { short: "Mer", full: "mercoledì" },
      thu: { short: "Gio", full: "giovedì" },
      fri: { short: "Ven", full: "venerdì" },
      sat: { short: "Sab", full: "sabato" },
      sun: { short: "Dom", full: "domenica" },
    },
  },
} satisfies MessageTree;
