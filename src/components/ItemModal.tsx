import { X } from "lucide-react";
import type { ItemListEntry } from "@/lib/pokeapi";
import { SpriteImg } from "@/components/SpriteImg";
import { Modal } from "@/components/ui/modal";

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
  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
        {/* Header */}
        <div className="flex items-center gap-4 border-b px-5 py-4">
          <SpriteImg src={`${SPRITES_BASE}/${item.name}.png`} alt={item.displayName} size="h-12 w-12" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold">{item.displayName}</h2>
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
    </Modal>
  );
}
