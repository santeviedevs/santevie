// Uppercase, accent-free slug: "Médecin Généraliste" -> "MEDECIN_GENERALISTE".
// Used as the code of the Contact lookup tables (contact type, specialization,
// role at center), which makes the unique index a case- and
// accent-insensitive duplicate guard on the typed name. Shared by the
// service (values typed into the comboboxes) and the seed, so both always
// derive the same code for the same name.
export function slugifyLookupName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
