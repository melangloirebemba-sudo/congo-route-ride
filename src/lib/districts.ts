// Arrondissements / quartiers connus par ville au Congo.
// Utilisé pour proposer un sélecteur lors de la création d'une sous-agence
// et pour filtrer la recherche client vers l'agence la plus proche.
export const DISTRICTS_BY_CITY: Record<string, string[]> = {
  Brazzaville: [
    "Makélékélé",
    "Bacongo",
    "Poto-Poto",
    "Moungali",
    "Ouenzé",
    "Talangaï",
    "Mfilou",
    "Madibou",
  ],
  "Pointe-Noire": [
    "Lumumba",
    "Mvou-Mvou",
    "Tié-Tié",
    "Loandjili",
    "Mongo-Mpoukou",
    "Ngoyo",
  ],
  Dolisie: ["Centre-ville", "Mouyondzi", "Loubomo"],
  Nkayi: ["Centre", "Kimongo"],
};

export const districtsFor = (city?: string | null): string[] => {
  if (!city) return [];
  const key = Object.keys(DISTRICTS_BY_CITY).find(
    (k) => k.toLowerCase() === city.toLowerCase()
  );
  return key ? DISTRICTS_BY_CITY[key] : [];
};
