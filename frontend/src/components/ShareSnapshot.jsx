import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, Copy, Check, Loader2, Twitter, Send as Telegram } from "lucide-react";
import html2canvas from "html2canvas-pro";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { colorForAlert } from "@/lib/alerts";

/**
 * Generates a shareable PNG snapshot of the current dashboard.
 * Features: download, copy-to-clipboard, share to X / Telegram.
 */
const ShareSnapshot = ({ alerts }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | building | ready
  const [dataUrl, setDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const top = [...alerts]
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 5);

  const generate = async () => {
    setStatus("building");
    // Give the overlay a moment to render before capture
    await new Promise((r) => setTimeout(r, 200));
    try {
      const node = document.getElementById("share-snapshot-canvas");
      if (!node) throw new Error("snapshot node not found");
      const canvas = await html2canvas(node, {
        backgroundColor: "#050505",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      setDataUrl(canvas.toDataURL("image/png"));
      setStatus("ready");
    } catch (e) {
      toast.error("Could not generate snapshot");
      setStatus("idle");
    }
  };

  const handleOpen = (v) => {
    setOpen(v);
    if (v) {
      setStatus("idle");
      setDataUrl(null);
      setCopied(false);
      setTimeout(generate, 120);
    }
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `alerts-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`;
    a.click();
    toast.success("Snapshot downloaded");
  };

  const handleCopy = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      toast.success("Image copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard copy not supported in this browser");
    }
  };

  const shareText = `Global Early Alert System — ${alerts.length} active signals, top risk ${(top[0]?.risk_score * 100 || 0).toFixed(0)}%. Live situational-awareness map:`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const shareX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const shareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => handleOpen(true)}
        className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white h-9 px-3 rounded-xl"
        data-testid="share-btn"
      >
        <Share2 className="w-3.5 h-3.5 mr-2" strokeWidth={2} />
        Share
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent
          className="glass border-white/10 text-white max-w-2xl"
          data-testid="share-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" strokeWidth={1.8} />
              Share alert snapshot
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              A PNG snapshot of the current top alerts. Download, copy, or post to X/Telegram.
            </DialogDescription>
          </DialogHeader>

          {/* Off-screen/live snapshot template that html2canvas renders */}
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#050505]">
            <div
              id="share-snapshot-canvas"
              className="p-6 bg-[#0A0F14]"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="label-overline text-zinc-400">Global Early Alert System</div>
                  <div className="font-display text-2xl font-semibold mt-1">
                    {alerts.length} active signals worldwide
                  </div>
                </div>
                <div className="text-right">
                  <div className="label-overline text-zinc-400">Snapshot</div>
                  <div className="font-mono-data text-sm mt-1">
                    {new Date().toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {top.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <span
                      className="w-1 h-10 rounded-full"
                      style={{ background: colorForAlert(a) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="label-overline"
                        style={{ color: colorForAlert(a) }}
                      >
                        {a.subtype} · {a.severity}
                      </div>
                      <div className="font-display text-sm font-medium truncate">
                        {a.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {a.region ? `${a.region}, ` : ""}{a.country}
                      </div>
                    </div>
                    <div className="font-mono-data text-sm text-white">
                      {(a.risk_score * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
                {top.length === 0 && (
                  <div className="text-zinc-500 text-sm text-center py-6">
                    No alerts to snapshot.
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500">
                <span>early-alert.live · situational-awareness</span>
                <span>Source: OpenWeather / WHO / ACLED · mock fallback</span>
              </div>
            </div>

            <AnimatePresence>
              {status === "building" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-zinc-300 text-sm"
                >
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Rendering snapshot…
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              onClick={handleDownload}
              disabled={!dataUrl}
              className="bg-white text-black hover:bg-zinc-200"
              data-testid="snapshot-download"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Download PNG
            </Button>
            <Button
              onClick={handleCopy}
              disabled={!dataUrl}
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              data-testid="snapshot-copy"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-2" />
                  Copy image
                </>
              )}
            </Button>
            <div className="flex-1" />
            <Button
              onClick={shareX}
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              data-testid="snapshot-share-x"
            >
              <Twitter className="w-3.5 h-3.5 mr-2" />
              Post to X
            </Button>
            <Button
              onClick={shareTelegram}
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              data-testid="snapshot-share-telegram"
            >
              <Telegram className="w-3.5 h-3.5 mr-2" />
              Telegram
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareSnapshot;
