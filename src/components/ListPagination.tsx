import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

const DEFAULT_SIZES = [5, 10, 25, 50];

export type UsePaginationOptions = {
  /** Optional URL query param namespace. When set, page & pageSize are persisted to the URL as `${paramKey}Page` and `${paramKey}Size` (or just `page`/`size` if paramKey === ""). */
  paramKey?: string;
};

export function usePagination<T>(
  items: T[],
  initialSize = 5,
  deps: unknown[] = [],
  options: UsePaginationOptions = {},
) {
  const { paramKey } = options;
  const persist = paramKey !== undefined;
  const pageParam = persist ? (paramKey ? `${paramKey}Page` : "page") : null;
  const sizeParam = persist ? (paramKey ? `${paramKey}Size` : "size") : null;

  const [searchParams, setSearchParams] = useSearchParams();

  const initialPage = persist ? Math.max(1, Number(searchParams.get(pageParam!)) || 1) : 1;
  const initialPageSize = persist
    ? Math.max(1, Number(searchParams.get(sizeParam!)) || initialSize)
    : initialSize;

  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [page, setPageState] = useState(initialPage);

  // Sync FROM url (back/forward navigation)
  useEffect(() => {
    if (!persist) return;
    const urlPage = Math.max(1, Number(searchParams.get(pageParam!)) || 1);
    const urlSize = Math.max(1, Number(searchParams.get(sizeParam!)) || initialSize);
    setPageState((p) => (p !== urlPage ? urlPage : p));
    setPageSizeState((s) => (s !== urlSize ? urlSize : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist ? searchParams.get(pageParam!) : null, persist ? searchParams.get(sizeParam!) : null]);

  const writeParams = useCallback(
    (next: { page?: number; size?: number }) => {
      if (!persist) return;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next.page !== undefined) {
            if (next.page <= 1) p.delete(pageParam!);
            else p.set(pageParam!, String(next.page));
          }
          if (next.size !== undefined) {
            if (next.size === initialSize) p.delete(sizeParam!);
            else p.set(sizeParam!, String(next.size));
          }
          return p;
        },
        { replace: true },
      );
    },
    [persist, pageParam, sizeParam, initialSize, setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setPageState(p);
      writeParams({ page: p });
    },
    [writeParams],
  );

  const setPageSize = useCallback(
    (n: number) => {
      setPageSizeState(n);
      setPageState(1);
      writeParams({ page: 1, size: n });
    },
    [writeParams],
  );

  // Reset to page 1 when filters/items change (but not on initial mount so URL page survives).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPageState(1);
    writeParams({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, pageSize, ...deps]);

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
