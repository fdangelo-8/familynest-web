import type { Page } from "@playwright/test";

// Test page for the CSS states added with #88 (hover and pressed rows, cards,
// day strip, time blocks, "adesso" line, "Già fatti" arrow). No page uses these
// classes yet (#25 and #30 will), so the visual and accessibility tests mount
// this markup, copied from the approved mockup (09-oggi, 12-calendario-settimana,
// 13-calendario-giorno), on a public page of the app. Links go nowhere ("#").

const AVATARS = `<span class="avatar-gruppo" role="img" aria-label="Marco, Laura"><span class="avatar membro-pomodoro" aria-hidden="true">M</span><span class="avatar membro-glicine" aria-hidden="true">L</span></span>`;

export const HARNESS_HTML = `
<div id="prova-stati" class="pagina" style="padding-block: 24px">
  <section data-gruppo="righe" class="sezione" aria-label="Righe degli impegni">
    <h2 class="sezione__titolo">Righe degli impegni</h2>
    <div class="sezione">
      <a id="riga" class="riga-evento" href="#riga"><span class="riga-evento__ora">19:30</span><span class="riga-evento__testo"><span class="riga-evento__titolo">Cena dai nonni</span><span class="riga-evento__info">Fino alle 21:30, Monza</span></span>${AVATARS}</a>
      <a id="riga-insieme" class="riga-evento riga-evento--insieme" href="#insieme"><span class="riga-evento__ora">21:30</span><span class="riga-evento__testo"><span class="riga-evento__titolo">Liberi insieme</span><span class="riga-evento__info">Tu e Laura, fino a fine serata</span></span>${AVATARS}</a>
      <div id="riga-occupato" class="riga-evento riga-evento--occupato"><span class="riga-evento__ora">9:00</span><span class="riga-evento__testo"><span class="riga-evento__titolo">Occupato</span><span class="riga-evento__info">Laura</span></span><span class="avatar-gruppo" role="img" aria-label="Laura"><span class="avatar membro-glicine" aria-hidden="true">L</span></span></div>
      <button id="gia-fatti" type="button" class="riga-gia-fatti" aria-expanded="false" aria-controls="gia-fatti-aperti"><svg class="icona icona--s" aria-hidden="true"><use href="#i-check"></use></svg><span>Già fatto: Palestra</span><svg class="icona icona--s" aria-hidden="true"><use href="#i-chevron-down"></use></svg></button>
      <button id="gia-fatti-aperto" type="button" class="riga-gia-fatti" aria-expanded="true" aria-controls="gia-fatti-aperti"><svg class="icona icona--s" aria-hidden="true"><use href="#i-check"></use></svg><span>Già fatti: Scuola, Palestra</span><svg class="icona icona--s" aria-hidden="true"><use href="#i-chevron-down"></use></svg></button>
      <div id="gia-fatti-aperti"></div>
    </div>
  </section>

  <section data-gruppo="schede" class="sezione" aria-label="Schede">
    <h2 class="sezione__titolo">Schede</h2>
    <div class="sezione">
      <a id="prossimo" class="scheda scheda--evidenza prossimo" href="#prossimo"><span class="prossimo__alto"><span class="prossimo__ora">16:00</span><span class="prossimo__dati"><span class="prossimo__titolo">Call con Acme</span><span class="prossimo__info">Fino alle 17:00, Teams</span></span></span><p class="prossimo__nota"><span class="etichetta etichetta--piccola"><svg class="icona icona--s" aria-hidden="true"><use href="#i-briefcase"></use></svg>Outlook</span></p></a>
      <div class="famiglia-contatori" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <a id="contatore" class="scheda contatore" href="#spesa"><span class="contatore__etichetta">Spesa</span><span class="contatore__numero">4</span><span class="contatore__info">Latte, pane, mele e altro</span></a>
        <a class="scheda contatore" href="#scadenze"><span class="contatore__etichetta">Scadenza</span><span class="contatore__numero">14</span><span class="contatore__info">giorni al certificato di Sofia</span></a>
      </div>
      <div class="spazi-fissati">
        <a id="spazio" class="scheda scheda-spazio" href="#spazio"><span class="scheda-spazio__icona"><svg class="icona" aria-hidden="true"><use href="#i-calendar"></use></svg></span><span><span class="scheda-spazio__titolo">Calendario</span><span class="scheda-spazio__info">3 impegni oggi</span></span></a>
        <a id="spazio-tratteggiato" class="scheda scheda--tratteggiata scheda-spazio" href="#esplora"><span class="scheda-spazio__icona"><svg class="icona" aria-hidden="true"><use href="#i-compass"></use></svg></span><span><span class="scheda-spazio__titolo">Esplora</span><span class="scheda-spazio__info">Altri 9 spazi</span></span></a>
      </div>
    </div>
  </section>

  <section data-gruppo="striscia" class="sezione" aria-label="Striscia dei giorni">
    <h2 class="sezione__titolo">Striscia dei giorni</h2>
    <div class="striscia-giorni" role="group" aria-label="Giorni della settimana">
      <button type="button" class="striscia-giorni__giorno" aria-pressed="false" aria-label="Lunedì 19 ottobre, 4 impegni"><span class="striscia-giorni__nome">Lun</span><span class="striscia-giorni__numero">19</span><span class="striscia-giorni__densita"><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span></span></button>
      <button id="giorno-scelto" type="button" class="striscia-giorni__giorno is-oggi is-selezionato" aria-pressed="true" aria-label="Martedì 20 ottobre, 6 impegni"><span class="striscia-giorni__nome">Mar</span><span class="striscia-giorni__numero">20</span><span class="striscia-giorni__densita"><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto striscia-giorni__punto--insieme"></span></span></button>
      <button id="giorno" type="button" class="striscia-giorni__giorno" aria-pressed="false" aria-label="Mercoledì 21 ottobre, 4 impegni"><span class="striscia-giorni__nome">Mer</span><span class="striscia-giorni__numero">21</span><span class="striscia-giorni__densita"><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span></span></button>
      <button type="button" class="striscia-giorni__giorno" aria-pressed="false" aria-label="Giovedì 22 ottobre, 2 impegni"><span class="striscia-giorni__nome">Gio</span><span class="striscia-giorni__numero">22</span><span class="striscia-giorni__densita"><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span></span></button>
      <button type="button" class="striscia-giorni__giorno" aria-pressed="false" aria-label="Venerdì 23 ottobre, 1 impegno"><span class="striscia-giorni__nome">Ven</span><span class="striscia-giorni__numero">23</span><span class="striscia-giorni__densita"><span class="striscia-giorni__punto"></span></span></button>
      <button type="button" class="striscia-giorni__giorno" aria-pressed="false" aria-label="Sabato 24 ottobre, nessun impegno"><span class="striscia-giorni__nome">Sab</span><span class="striscia-giorni__numero">24</span><span class="striscia-giorni__densita"></span></button>
      <button type="button" class="striscia-giorni__giorno" aria-pressed="false" aria-label="Domenica 25 ottobre, 3 impegni"><span class="striscia-giorni__nome">Dom</span><span class="striscia-giorni__numero">25</span><span class="striscia-giorni__densita"><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span><span class="striscia-giorni__punto"></span></span></button>
    </div>
  </section>

  <section data-gruppo="orario" class="sezione" aria-label="Blocchi orari">
    <h2 class="sezione__titolo">Blocchi orari</h2>
    <div class="giorno-persone">
      <div class="giorno-persone__corpo">
        <div class="colonna-ore" aria-hidden="true" style="grid-template-rows:repeat(9,var(--h))"><span class="colonna-ore__ora">8</span><span class="colonna-ore__ora">9</span><span class="colonna-ore__ora">10</span><span class="colonna-ore__ora">11</span><span class="colonna-ore__ora">12</span><span class="colonna-ore__ora">13</span><span class="colonna-ore__ora">14</span><span class="colonna-ore__ora">15</span><span class="colonna-ore__ora">16</span></div>
        <div class="area-orari" style="--ore:9">
          <a id="blocco" class="blocco-orario" href="#blocco" style="top:calc(var(--h) * 1);height:var(--h);left:0;width:46%"><span class="blocco-orario__titolo">Palestra</span><span class="blocco-orario__ora">9:00 – 10:00</span></a>
          <button id="blocco-pulsante" type="button" class="blocco-orario" style="top:calc(var(--h) * 3);height:var(--h);left:0;width:46%;text-align:left;border:0;font:inherit"><span class="blocco-orario__titolo">Nuoto Sofia</span><span class="blocco-orario__ora">11:00 – 12:00</span></button>
          <div id="blocco-occupato" class="blocco-orario blocco-orario--occupato" style="top:calc(var(--h) * 1);height:calc(var(--h) * 2);left:50%;width:46%"><span class="blocco-orario__titolo">Occupato</span><span class="blocco-orario__ora">9:00 – 11:00</span></div>
          <div id="blocco-insieme" class="blocco-orario blocco-orario--insieme" style="top:calc(var(--h) * 5);height:calc(var(--h) * 2);left:0;width:96%"><span class="blocco-orario__titolo">Liberi insieme</span><span class="blocco-orario__ora">13:00 – 15:00</span></div>
          <span id="adesso" class="linea-adesso" aria-hidden="true"></span>
        </div>
      </div>
    </div>
  </section>

  <section data-gruppo="passi" class="sezione" aria-label="Primi passi">
    <h2 class="sezione__titolo">Primi passi</h2>
    <div class="scheda scheda--imbottita">
      <div class="lista-partenza">
        <div class="passo-partenza is-fatto"><span class="passo-partenza__cerchio"><svg class="icona icona--s" aria-hidden="true"><use href="#i-check"></use></svg></span><span class="passo-partenza__testo">Crea il Nest</span><span></span></div>
        <a id="passo" class="passo-partenza" href="#passo"><span class="passo-partenza__cerchio"></span><span class="passo-partenza__testo">Collega il tuo calendario</span><svg class="icona" aria-hidden="true"><use href="#i-chevron-right"></use></svg></a>
        <a class="passo-partenza" href="#spesa"><span class="passo-partenza__cerchio"></span><span class="passo-partenza__testo">Scrivi la prima spesa</span><svg class="icona" aria-hidden="true"><use href="#i-chevron-right"></use></svg></a>
      </div>
    </div>
  </section>
</div>`;

/** "Adesso" at 15:52: hours past 8:00, as the pages will set it. */
export const ADESSO_ORE = "7.8667";

/** Replaces the body of the current (public) page with the test markup. */
export async function mountHarness(page: Page) {
  await page.evaluate(
    ({ html, ore }) => {
      // Keep the icon sprite of the root layout; drop the rest of the page.
      for (const child of Array.from(document.body.children)) {
        if (!child.matches("svg.sprite-icone")) child.remove();
      }
      const main = document.createElement("main");
      main.id = "contenuto";
      main.innerHTML = html;
      document.body.append(main);
      const gia = document.getElementById("gia-fatti-aperti");
      if (gia) gia.hidden = true;
      document.getElementById("adesso")?.style.setProperty("--adesso-ore", ore);
    },
    { html: HARNESS_HTML, ore: ADESSO_ORE },
  );
  await page.evaluate(() => document.fonts.ready);
}
