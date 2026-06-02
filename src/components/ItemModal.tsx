import { useEffect } from "react";
import { X } from "lucide-react";
import type { ItemListEntry } from "@/lib/pokeapi";
import { SpriteImg } from "@/components/SpriteImg";

const SPRITES_BASE = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items";

function formatCost(cost: number): string {
  if (cost === 0) return "Not sold in shops";
  return `₽${cost.toLocaleString()}`;
}

interface ItemModalProps {
  item: ItemListEntry;
  onClose: () => void;
}

export function ItemModal({ item, onClose }: ItemModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 border-b px-5 py-4">
          <SpriteImg src={`${SPRITES_BASE}/${item.name}.png`} alt={item.displayName} size="h-12 w-12" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{item.displayName}</h2>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {item.categoryDisplay}
            </span>
          </div>
          <button
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {item.shortEffect && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Effect
              </p>
              <p className="text-sm leading-relaxed">{item.shortEffect}</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Buy Price
            </p>
            <p className="text-sm">{formatCost(item.cost)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
