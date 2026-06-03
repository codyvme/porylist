import { X } from "lucide-react";
import { TYPE_COLORS } from "@/lib/types";
import { useSingleMoveDetail, type MoveListEntry } from "@/lib/pokeapi";
import { bestFlavorText, type GameOption } from "@/lib/games";
import { Modal } from "@/components/ui/modal";

const CATEGORY_STYLE: Record<string, { bg: string; label: string }> = {
  physical: { bg: "#C92112", label: "Physical" },
  special:  { bg: "#4F5870", label: "Special"  },
  status:   { bg: "#8C888C", label: "Status"   },
};

const VERSION_GROUP_LABELS: Record<string, string> = {
  "red-blue":                            "Red/Blue",
  "yellow":                              "Yellow",
  "gold-silver":                         "Gold/Silver",
  "crystal":                             "Crystal",
  "ruby-sapphire":                       "Ruby/Sapphire",
  "emerald":                             "Emerald",
  "firered-leafgreen":                   "FireRed/LeafGreen",
  "diamond-pearl":                       "Diamond/Pearl",
  "platinum":                            "Platinum",
  "heartgold-soulsilver":                "HeartGold/SoulSilver",
  "black-white":                         "Black/White",
  "black-2-white-2":                     "Black 2/White 2",
  "x-y":                                 "X/Y",
  "omega-ruby-alpha-sapphire":           "Omega Ruby/Alpha Sapphire",
  "sun-moon":                            "Sun/Moon",
  "ultra-sun-ultra-moon":                "Ultra Sun/Ultra Moon",
  "lets-go-pikachu-lets-go-eevee":       "Let's Go",
  "sword-shield":                        "Sword/Shield",
  "brilliant-diamond-and-shining-pearl": "Brilliant Diamond/Shining Pearl",
  "legends-arceus":                      "Legends: Arceus",
  "scarlet-violet":                      "Scarlet/Violet",
};

function substituteChance(text: string, chance: number | null): string {
  if (!chance) return text;
  return text.replace(/\$effect_chance%?/g, `${chance}%`);
}

interface MoveModalProps {
  name: string;
  entry?: MoveListEntry;
  game?: GameOption | null;
  onClose: () => void;
}

export function MoveModal({ name, entry, game, onClose }: MoveModalProps) {
  const { data: detail, isLoading } = useSingleMoveDetail(name);

  const displayName = detail?.names?.find((n) => n.language.name === "en")?.name
    ?? entry?.displayName
    ?? name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const type = detail?.type?.name ?? entry?.type ?? "normal";
  const category = detail?.damage_class?.name ?? entry?.category ?? "status";
  const power = detail?.power ?? entry?.power ?? null;
  const accuracy = detail?.accuracy ?? entry?.accuracy ?? null;
  const pp = detail?.pp ?? entry?.pp ?? null;
  const effectChance = detail?.effect_chance ?? entry?.effectChance ?? null;

  const shortEffect = substituteChance(
    detail?.effect_entries?.find((e) => e.language.name === "en")?.short_effect
      ?? entry?.shortEffect ?? "",
    effectChance,
  );

  // Pick the best flavor text entry for the selected game (or latest if no game)
  const flavorEntry = detail
    ? bestFlavorText(detail.flavor_text_entries, game ?? null)
    : undefined;

  const typeColor = TYPE_COLORS[type] ?? "#A8A8A8";
  const catStyle = CATEGORY_STYLE[category];

  return (
    <Modal onClose={onClose}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize text-white"
                style={{ backgroundColor: typeColor }}
              >
                {type}
              </span>
              {catStyle && (
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: catStyle.bg }}
                >
                  {catStyle.label}
                </span>
              )}
            </div>
          </div>
          <button
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-border rounded-lg border">
            {[
              { label: "Power",    value: power    != null ? String(power)  : "—" },
              { label: "Accuracy", value: accuracy != null ? `${accuracy}%` : "—" },
              { label: "PP",       value: pp       != null ? String(pp)     : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center py-3">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="mt-0.5 text-lg font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          {/* Effect */}
          {isLoading ? (
            <div className="space-y-1.5">
              <div className="h-3.5 w-1/4 skeleton-shimmer rounded" />
              <div className="h-4 w-full skeleton-shimmer rounded" />
              <div className="h-4 w-3/4 skeleton-shimmer rounded" />
            </div>
          ) : shortEffect ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Effect
              </p>
              <p className="text-sm leading-relaxed">{shortEffect}</p>
            </div>
          ) : null}

          {/* Game-specific flavor text */}
          {flavorEntry && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                In-game description
                <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                  ({VERSION_GROUP_LABELS[flavorEntry.version_group.name] ?? flavorEntry.version_group.name})
                </span>
              </p>
              <p className="text-sm italic leading-relaxed text-muted-foreground">
                {flavorEntry.flavor_text.replace(/\n/g, " ")}
              </p>
            </div>
          )}
        </div>
    </Modal>
  );
}
