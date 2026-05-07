import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Clock, ChevronLeft, TrendingUp, Share2, Sparkles } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/alerts";
import { listHistory, ensureSeed, formatPrettyDate } from "@/lib/digestHistory";

const Row = ({ entry, onOpen }) => (
  <motion.button
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={() => onOpen(entry)}
    className="w-full text-left rounded-xl border border-white/5 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/15 transition-colors p-3.5 group"
    data-testid={`history-row-${entry.date}`}
  >
    <div className="flex items-center justify-between mb-1">
      <span className="font-mono-data text-[11px] text-zinc-300">
        {formatPrettyDate(entry.date)}
      </span>
      {entry.seeded && (
        <span className="text-[9px] uppercase tracking-wider text-amber-300/80 font-bold">
          archive
        </span>
      )}
    </div>
    <div className="flex items-baseline gap-2">
      <span className="font-display text-lg font-semibold font-mono-data">
        {entry.total}
      </span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
        signals · {entry.countries} countries
      </span>
    </div>
    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1">
      <TrendingUp className="w-3 h-3" />
      <span>
        Top:{" "}
        <span
          className="capitalize font-medium"
          style={{ color: CATEGORY_COLORS[entry.topCategory] }}
        >
          {entry.topCategory}
        </span>{" "}
        · {entry.topRisk.title}
      </span>
    </div>
  </motion.button>
);

const Detail = ({ entry, onBack, onShare }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0 }}
    className="space-y-4"
  >
    <button
      onClick={onBack}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
      data-testid="history-back"
    >
      <ChevronLeft className="w-3.5 h-3.5" />
      Back to history
    </button>

    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5">
      <div className="label-overline text-amber-300/90 mb-2">
        Risk Digest · {formatPrettyDate(entry.date)}
      </div>
      <div className="font-display text-3xl font-semibold font-mono-data">
        {entry.total}
      </div>
      <div className="text-xs text-zinc-400 uppercase tracking-wider mt-0.5">
        signals · {entry.countries} countries
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="text-zinc-400">Leading:</span>
        <span
          className="capitalize font-medium"
          style={{ color: CATEGORY_COLORS[entry.topCategory] }}
        >
          {entry.topCategory}
        </span>
        <span className="text-zinc-500">({entry.topCategoryCount})</span>
      </div>

      <div className="mt-4 rounded-lg bg-black/30 border border-white/5 p-3">
        <div className="label-overline text-zinc-500 mb-1">Top risk</div>
        <div className="text-sm font-medium">{entry.topRisk.title}</div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[11px] text-zinc-500">{entry.topRisk.country}</span>
          <span className="text-[11px] font-mono-data">
            {(entry.topRisk.risk_score * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>

    <Button
      onClick={() => onShare(entry)}
      variant="outline"
      className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
      data-testid="history-share"
    >
      <Share2 className="w-3.5 h-3.5 mr-2" />
      Share this digest
    </Button>

    {entry.seeded && (
      <div className="text-[10px] text-amber-300/70 leading-relaxed flex items-start gap-1.5">
        <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
        Seeded archive sample — synthesized for demo purposes.
      </div>
    )}
  </motion.div>
);

const DigestHistoryDrawer = () => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    ensureSeed();
  }, []);

  useEffect(() => {
    if (open) {
      setEntries(listHistory());
      setSelected(null);
    }
  }, [open]);

  const handleShare = () => {
    setOpen(false);
    setTimeout(() => {
      const btn = document.querySelector("[data-testid='share-btn']");
      if (btn) btn.click();
    }, 300);
  };

  const sorted = useMemo(() => entries, [entries]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="text-zinc-400 hover:text-white transition-colors"
          title="Digest history"
          data-testid="digest-history-btn"
        >
          <Clock className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="glass border-white/10 text-white w-[400px] sm:max-w-[400px]"
        data-testid="digest-history-drawer"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl tracking-tight flex items-center gap-2 text-white">
            <Clock className="w-4 h-4 text-amber-300" strokeWidth={1.8} />
            Digest history
          </SheetTitle>
          <SheetDescription className="text-zinc-400 text-xs">
            Browse past daily Risk Digests and re-share any moment in the timeline.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {selected ? (
              <Detail
                key="detail"
                entry={selected}
                onBack={() => setSelected(null)}
                onShare={handleShare}
              />
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2.5 max-h-[calc(100vh-180px)] overflow-y-auto thin-scroll pr-1"
                data-testid="history-list"
              >
                {sorted.length === 0 && (
                  <div className="text-center text-sm text-zinc-500 py-10">
                    No history yet. Today's digest will appear here.
                  </div>
                )}
                {sorted.map((e) => (
                  <Row key={e.date} entry={e} onOpen={setSelected} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DigestHistoryDrawer;
