import { Icon, type IconName } from "@/components/ui/Icon/Icon";

const ASSURANCES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "eye-off",
    title: "Gli altri vedono solo che sei occupato",
    text: "Mai il titolo né il luogo dei tuoi impegni di lavoro.",
  },
  {
    icon: "repeat",
    title: "In due direzioni",
    text: "Quello che aggiungi qui può andare anche lì, e viceversa.",
  },
  {
    icon: "sliders-horizontal",
    title: "Scegli dopo cosa tenere",
    text: "Da Impostazioni › Calendari collegati.",
  },
];

/** Title of the calendar step, shared by the step and its skeleton. */
export function Heading() {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">Le tue giornate</p>
      <h1 className="intestazione__titolo t-titolo-pagina">
        Porta qui il tuo calendario
      </h1>
    </div>
  );
}

/** The three assurances, shared by the step and its skeleton. */
export function Assurances() {
  return (
    <ul className="scheda lista">
      {ASSURANCES.map((item) => (
        <li key={item.title} className="riga-lista">
          <span className="icona-riquadro">
            <Icon name={item.icon} />
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{item.title}</span>
            <span className="riga-lista__info">{item.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
