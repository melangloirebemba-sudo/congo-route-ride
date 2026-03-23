interface SeatSelectorProps {
  totalSeats: number;
  availableSeats: number;
  selected: number | null;
  onSelect: (seat: number) => void;
}

const SeatSelector = ({ totalSeats, availableSeats, selected, onSelect }: SeatSelectorProps) => {
  const occupied = new Set<number>();
  // Simulate occupied seats
  for (let i = 1; occupied.size < totalSeats - availableSeats; i++) {
    occupied.add((i * 7 + 3) % totalSeats + 1);
  }

  const cols = 4;
  const rows = Math.ceil(totalSeats / cols);

  return (
    <div>
      <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-secondary border border-border" /> Libre</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted-foreground/30" /> Occupé</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary" /> Sélectionné</span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const seatNum = i + 1;
          if (seatNum > totalSeats) return <div key={i} />;
          const isOccupied = occupied.has(seatNum);
          const isSelected = selected === seatNum;
          // Add aisle gap
          const isAisle = (i % cols) === 1;
          return (
            <button
              key={seatNum}
              disabled={isOccupied}
              onClick={() => onSelect(seatNum)}
              className={`h-9 rounded-md text-xs font-medium transition-all ${
                isAisle ? "mr-3" : ""
              } ${
                isSelected
                  ? "bg-primary text-primary-foreground scale-110 shadow-md"
                  : isOccupied
                  ? "bg-muted-foreground/20 text-muted-foreground/40 cursor-not-allowed"
                  : "bg-secondary text-secondary-foreground hover:bg-primary/20 active:scale-95"
              }`}
            >
              {seatNum}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SeatSelector;
