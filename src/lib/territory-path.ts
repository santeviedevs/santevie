type Named = { name: string } | null | undefined;

// "Province › Ville › Commune › Quartier" — only the levels the Territory
// actually has, same separator as the territory pickers (territory-service's
// option label).
export function formatTerritoryPath(
  territory:
    { province: Named; ville?: Named; commune?: Named; quartier?: Named } | null | undefined,
): string {
  if (!territory) return "";
  return [territory.province, territory.ville, territory.commune, territory.quartier]
    .map((level) => level?.name)
    .filter(Boolean)
    .join(" › ");
}
