import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Trash2, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tables } from "@/integrations/supabase/types";

type Agency = Tables<"agencies">;

const AgenciesAdmin = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [search, setSearch] = useState("");
  const [newAgency, setNewAgency] = useState({ name: "", email: "", phone: "", address: "" });
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAgencies = async () => {
    const { data } = await supabase.from("agencies").select("*").order("created_at", { ascending: false });
    setAgencies(data || []);
  };

  useEffect(() => { fetchAgencies(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("agencies").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Agence ${status === "active" ? "activée" : "suspendue"}`);
    fetchAgencies();
  };

  const deleteAgency = async (id: string) => {
    const { error } = await supabase.from("agencies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Agence supprimée");
    fetchAgencies();
  };

  const createAgency = async () => {
    if (!newAgency.name) { toast.error("Le nom est requis"); return; }
    const { error } = await supabase.from("agencies").insert({
      name: newAgency.name, email: newAgency.email || null,
      phone: newAgency.phone || null, address: newAgency.address || null,
      status: "active",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Agence créée");
    setNewAgency({ name: "", email: "", phone: "", address: "" });
    setDialogOpen(false);
    fetchAgencies();
  };

  const filtered = agencies.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-accent/20 text-accent",
      pending: "bg-warning/20 text-warning-foreground",
      suspended: "bg-destructive/20 text-destructive",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ""}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Gestion des agences</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle agence</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Nom de l'agence *" value={newAgency.name} onChange={e => setNewAgency(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Email" value={newAgency.email} onChange={e => setNewAgency(p => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Téléphone" value={newAgency.phone} onChange={e => setNewAgency(p => ({ ...p, phone: e.target.value }))} />
              <Input placeholder="Adresse" value={newAgency.address} onChange={e => setNewAgency(p => ({ ...p, address: e.target.value }))} />
              <Button onClick={createAgency} className="w-full gradient-primary text-primary-foreground">Créer l'agence</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher une agence..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-3">
        {filtered.map(agency => (
          <Card key={agency.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{agency.logo}</span>
                    <div>
                      <h3 className="font-display font-semibold">{agency.name}</h3>
                      <p className="text-xs text-muted-foreground">{agency.email} • {agency.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {statusBadge(agency.status)}
                    <span className="text-xs text-muted-foreground">Commission: {agency.commission_rate}%</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {agency.status !== "active" && (
                    <Button size="icon" variant="ghost" onClick={() => updateStatus(agency.id, "active")} title="Activer">
                      <Check className="h-4 w-4 text-accent" />
                    </Button>
                  )}
                  {agency.status !== "suspended" && (
                    <Button size="icon" variant="ghost" onClick={() => updateStatus(agency.id, "suspended")} title="Suspendre">
                      <X className="h-4 w-4 text-warning" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteAgency(agency.id)} title="Supprimer">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucune agence trouvée</p>
        )}
      </div>
    </div>
  );
};

export default AgenciesAdmin;
