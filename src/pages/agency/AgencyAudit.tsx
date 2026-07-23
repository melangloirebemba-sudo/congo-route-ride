import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";

type Log = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  branch_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
};

const actionLabel: Record<string, string> = {
  permission_changed: "Permission modifiée",
  booking_created: "Réservation créée",
  booking_checked_in: "Billet scanné",
  trip_created: "Trajet créé",
  trip_updated: "Trajet modifié",
};

const actionColor: Record<string, string> = {
  permission_changed: "bg-primary/10 text-primary",
  booking_created: "bg-accent/20 text-accent",
  booking_checked_in: "bg-blue-500/15 text-blue-600",
  trip_created: "bg-emerald-500/15 text-emerald-600",
  trip_updated: "bg-amber-500/15 text-amber-600",
};

const AgencyAudit = () => {
  const { agencyId } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [branches, setBranches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const pg = usePagination(logs, 10, [], { paramKey: "" });

  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      setLoading(true);
      const [{ data: l, error }, { data: b }] = await Promise.all([
        supabase.from("agency_audit_logs" as any).select("*").eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(500),
        supabase.from("agency_branches" as any).select("id, name").eq("agency_id", agencyId),
      ]);
      if (error) toast.error(error.message);
      setLogs((l as any) || []);
      const map: Record<string, string> = {};
      (b as any[])?.forEach((x: any) => { map[x.id] = x.name; });
      setBranches(map);
      setLoading(false);
    })();
  }, [agencyId]);

  const describe = (log: Log) => {
    const d = log.details || {};
    switch (log.action) {
      case "permission_changed": {
        const changes = d.changes || {};
        const items = Object.entries(changes).map(([k, v]: any) => {
          const to = v?.to ? "activée" : "désactivée";
          const labels: Record<string, string> = {
            can_create_trips: "Créer trajets",
            can_sell_counter: "Vendre au guichet",
            can_scan: "Scanner billets",
            can_view_stats: "Voir statistiques",
          };
          return `${labels[k] || k} : ${to}`;
        });
        return items.join(" · ");
      }
      case "booking_created":
        return `Siège #${d.seat} — ${d.amount ?? 0} FCFA (${d.payment_method || "—"} / ${d.payment_status || "—"})`;
      case "booking_checked_in":
        return `Siège #${d.seat}`;
      case "trip_created":
      case "trip_updated":
        return `${d.departure} → ${d.destination} · ${d.date?.slice(0, 10) || ""} · ${d.price ?? 0} FCFA`;
      default:
        return JSON.stringify(d);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Journal d'audit</h1>
        <p className="text-sm text-muted-foreground">
          Toutes les actions sensibles réalisées dans votre agence (permissions, trajets, ventes, scans).
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <ScrollText className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="font-display font-semibold">Aucune activité</p>
              <p className="text-sm text-muted-foreground">Les événements apparaîtront ici automatiquement.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Agence secondaire</TableHead>
                    <TableHead>Auteur</TableHead>
                    <TableHead>Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pg.paginated.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                      <TableCell>
                        <Badge className={`${actionColor[log.action] || "bg-muted"} border-0`}>
                          {actionLabel[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.branch_id ? branches[log.branch_id] || "—" : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.actor_role || "—"}</TableCell>
                      <TableCell className="text-sm">{describe(log)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && logs.length > 0 && (
            <div className="p-4 border-t"><ListPagination {...pg} /></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyAudit;
