import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DISTRICTS_BY_CITY } from "@/lib/districts";

export type CityDistrict = { id: string; city: string; name: string };

// Fetch districts from DB, fallback-merged with the static defaults so the UI
// keeps working even when the table is empty or offline.
export const useDistricts = () => {
  const [rows, setRows] = useState<CityDistrict[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("city_districts" as any)
      .select("id, city, name")
      .order("city")
      .order("name");
    setRows(((data as any) || []) as CityDistrict[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const byCity = (city?: string | null): string[] => {
    if (!city) return [];
    const key = city.trim().toLowerCase();
    const fromDb = rows.filter(r => r.city.toLowerCase() === key).map(r => r.name);
    const staticKey = Object.keys(DISTRICTS_BY_CITY).find(k => k.toLowerCase() === key);
    const fallback = staticKey ? DISTRICTS_BY_CITY[staticKey] : [];
    return Array.from(new Set([...fromDb, ...fallback])).sort();
  };

  const cities = () => Array.from(new Set(rows.map(r => r.city))).sort();

  return { rows, loading, byCity, cities, reload: load };
};
