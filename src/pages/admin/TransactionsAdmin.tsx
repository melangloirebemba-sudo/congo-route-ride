import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPagination, usePagination } from "@/components/ListPagination";

const TransactionsAdmin = () => {
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, agencies(name), bookings(passenger_name, phone)")
        .order("created_at", { ascending: false });
      setTransactions(data || []);
    };
    fetch();
  }, []);

  const pg = usePagination(transactions);

  const statusColor = (s: string) => {
    if (s === "completed") return "bg-accent/20 text-accent";
    if (s === "failed") return "bg-destructive/20 text-destructive";
    if (s === "refunded") return "bg-warning/20 text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Transactions</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Passager</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Aucune transaction
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">{new Date(tx.created_at).toLocaleDateString("fr")}</TableCell>
                      <TableCell className="text-sm font-medium">{tx.bookings?.passenger_name || "—"}</TableCell>
                      <TableCell className="text-sm">{tx.agencies?.name || "—"}</TableCell>
                      <TableCell className="font-semibold">{tx.amount.toLocaleString()} FCFA</TableCell>
                      <TableCell className="text-warning">{tx.commission.toLocaleString()} FCFA</TableCell>
                      <TableCell className="text-accent">{tx.net_amount.toLocaleString()} FCFA</TableCell>
                      <TableCell className="text-xs">{tx.payment_method}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsAdmin;
