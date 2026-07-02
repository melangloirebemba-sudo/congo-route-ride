import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, MapPin } from "lucide-react";
import { useDistricts } from "@/hooks/useDistricts";

const DistrictsAdmin = () => {
  const { rows, loading, reload } = useDistricts();
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    rows
      .filter(r => !filter || r.city.toLowerCase().includes(filter.toLowerCase()) || r.name.toLowerCase().includes(filter.toLowerCase()))
      .forEach(r => {
        const list = map.get(r.city) || [];
        list.push({ id: r.id, name: r.name });
        map.set(r.city, list);
      });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, filter]);

  const add = async () => {
    const c = city.trim();
    const n = name.trim();
    if (!c || !n) { toast.error("Ville et arrondissement requis"); return; }
    const { error } = await supabase.from("city_districts" as any).insert({ city: c, name: n });
    if (error) { toast.error(error.message); return; }
    toast.success("Arrondissement ajouté");
    setName("");
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cet arrondissement ?")) return;
    const { error } = await supabase.from("city_districts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé");
    reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Arrondissements par ville</h1>
        <p className="text-sm text-muted-foreground">
          Gérez la liste utilisée pour la recherche client et la création des sous-agences.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ajouter un arrondissement</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <Input placeholder="Ville (ex. Brazzaville)" value={city} onChange={e => setCity(e.target.value)} />
          <Input placeholder="Arrondissement / quartier (ex. Bacongo)" value={name} onChange={e => setName(e.target.value)} />
          <Button onClick={add} className="gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Liste actuelle</CardTitle>
          <Input placeholder="Filtrer…" className="max-w-xs" value={filter} onChange={e => setFilter(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : grouped.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucun arrondissement.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ville</TableHead>
                  <TableHead>Arrondissements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([c, items]) => (
                  <TableRow key={c}>
                    <TableCell className="font-medium align-top w-40">{c}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {items.map(it => (
                          <span key={it.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                            {it.name}
                            <button
                              onClick={() => remove(it.id)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Supprimer ${it.name}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DistrictsAdmin;
