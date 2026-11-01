import type { AddType } from "./detect-type";

/** What the address of the Add sheet asks for (`?tipo=` and `?modifica=`). */
export type AddAddress = {
  initialType: AddType | null;
  editId: string | null;
  editKind: "da-fare" | "scadenza" | null;
};

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === "string" && one !== "" ? one : null;
}

/**
 * Reads the address. An unknown `tipo` is ignored; `modifica` holds only the
 * id of the thing (never a title) and may come without a `tipo`.
 */
export function readAddAddress(params: Params): AddAddress {
  const tipo = first(params.tipo);
  const initialType: AddType | null =
    tipo === "spesa" || tipo === "da-fare" || tipo === "scadenza" ? tipo : null;
  const editId = first(params.modifica);
  return {
    initialType: editId ? null : initialType,
    editId,
    editKind:
      editId && (tipo === "da-fare" || tipo === "scadenza") ? tipo : null,
  };
}
