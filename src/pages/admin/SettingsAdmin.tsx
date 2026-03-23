import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Save, Plus } from "lucide-react";

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

const SettingsAdmin = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const fetchSettings = async () => {
    const { data } = await supabase.from("platform_settings").select("*").order("key");
    setSettings(data || []);
    const vals: Record<string, string> = {};
    (data || []).forEach(s => { vals[s.id] = s.value; });
    setEditValues(vals);
  };

  useEffect(() => { fetchSettings(); }, []);

  const addSetting = async () => {
    if (!newKey || !newValue) { toast.error("Clé et valeur requises"); return; }
    const { error } = await supabase.from("platform_settings").insert({
      key: newKey, value: newValue, description: newDesc || null, updated_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Paramètre ajouté");
    setNewKey(""); setNewValue(""); setNewDesc("");
    fetchSettings();
  };

  const updateSetting = async (id: string) => {
    const { error } = await supabase.from("platform_settings")
      .update({ value: editValues[id], updated_by: user?.id })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Paramètre mis à jour");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Paramètres de la plateforme</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Ajouter un paramètre</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Clé (ex: default_commission)" value={newKey} onChange={e => setNewKey(e.target.value)} />
            <Input placeholder="Valeur" value={newValue} onChange={e => setNewValue(e.target.value)} />
            <Input placeholder="Description (optionnel)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          </div>
          <Button onClick={addSetting} className="gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Paramètres existants</CardTitle></CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun paramètre configuré</p>
          ) : (
            <div className="space-y-4">
              {settings.map(s => (
                <div key={s.id} className="flex items-end gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground">{s.key}</label>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                    <Input
                      value={editValues[s.id] || ""}
                      onChange={e => setEditValues(p => ({ ...p, [s.id]: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <Button size="icon" onClick={() => updateSetting(s.id)} title="Sauvegarder">
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsAdmin;
