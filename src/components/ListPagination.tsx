import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

const DEFAULT_SIZES = [5, 10, 25, 50];

export function usePagination<T>(items: T[], initialSize = 5, deps: unknown[] = []) {
  const [pageSize, setPageSize] = useState(initialSize);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [items.length, pageSize, ...deps]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize],
  );

  return {
    paginated,
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: items.length,
    start,
  };
}

type ListPaginationProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  start: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  sizes?: number[];
  className?: string;
};

export const ListPagination = ({
  page, totalPages, pageSize, total, start,
  setPage, setPageSize, sizes = DEFAULT_SIZES, className = "",
}: ListPaginationProps) => {
  const from = total === 0 ? 0 : start + 1;
  const to = Math.min(start + pageSize, total);
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm ${className}`}>
      <div className="text-muted-foreground">
        {total === 0 ? "Aucun résultat" : `Affichage ${from}–${to} sur ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Lignes</span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sizes.map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-2">
          <Button size="icon" variant="outline" className="h-8 w-8"
            onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8"
            onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 tabular-nums">{page} / {totalPages}</span>
          <Button size="icon" variant="outline" className="h-8 w-8"
            onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8"
            onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
