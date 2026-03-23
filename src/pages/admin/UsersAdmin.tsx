import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const UsersAdmin = () => {
  const [roles, setRoles] = useState<any[]>([]);

  const fetchRoles = async () => {
    const { data } = await supabase.from("user_roles").select("*").order("created_at", { ascending: false });
    setRoles(data || []);
  };

  useEffect(() => { fetchRoles(); }, []);

  const removeRole = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rôle supprimé");
    fetchRoles();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Gestion des utilisateurs</h1>
      <p className="text-sm text-muted-foreground">
        Pour ajouter un administrateur, insérez un enregistrement dans la table user_roles via Cloud → Database.
      </p>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucun rôle attribué
                  </TableCell>
                </TableRow>
              ) : (
                roles.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">{r.user_id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        {r.role === "admin" ? <Shield className="h-3 w-3 text-primary" /> : <User className="h-3 w-3" />}
                        {r.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("fr")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => removeRole(r.id)}>
                        Retirer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersAdmin;
