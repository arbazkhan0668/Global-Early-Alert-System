import { useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail, Check, Loader2, X, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_OPTIONS = [
  { key: "weather", label: "Weather & Floods", color: "#FF3B30" },
  { key: "disease", label: "Disease Outbreaks", color: "#34C759" },
  { key: "conflict", label: "Conflict Zones", color: "#FFCC00" },
];
const SEV_LABELS = ["low", "moderate", "high", "critical"];

/**
 * Subscribe modal. Calls real backend POST /api/subscribe which persists
 * the subscription in Mongo and sends a confirmation email via Resend.
 */
const SubscribeModal = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [cats, setCats] = useState({ weather: true, disease: true, conflict: true });
  const [minSev, setMinSev] = useState(2);
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [sentEmail, setSentEmail] = useState("");

  const reset = () => {
    setEmail("");
    setCats({ weather: true, disease: true, conflict: true });
    setMinSev(2);
    setStatus("idle");
    setSentEmail("");
  };

  const handleSend = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }
    const chosen = Object.entries(cats).filter(([, v]) => v).map(([k]) => k);
    if (chosen.length === 0) {
      toast.error("Pick at least one category");
      return;
    }
    setStatus("sending");
    try {
      await axios.post(`${API}/subscribe`, {
        email,
        categories: chosen,
        min_severity: SEV_LABELS[minSev],
      });
      setSentEmail(email);
      setStatus("sent");
      toast.success("Subscribed", {
        description: `Confirmation email sent to ${email}`,
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not subscribe";
      toast.error(detail);
      setStatus("idle");
    }
  };

  const handleSendTest = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter your email above first");
      return;
    }
    setStatus("sending");
    try {
      await axios.post(`${API}/test-email`, { email });
      setSentEmail(email);
      setStatus("sent");
      toast.success("Test alert sent", {
        description: `Check ${email} (Resend test mode delivers only to your registered Resend address).`,
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || "Test email failed";
      toast.error(detail);
      setStatus("idle");
    }
  };

  const handleClose = (v) => {
    setOpen(v);
    if (!v) setTimeout(reset, 250);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-white text-black hover:bg-zinc-200 font-medium h-9 px-4 rounded-xl"
        data-testid="subscribe-btn"
      >
        <Bell className="w-3.5 h-3.5 mr-2" strokeWidth={2} />
        Subscribe
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="glass border-white/10 text-white max-w-md"
          data-testid="subscribe-modal"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" strokeWidth={1.8} />
              Alert Subscription
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Get matching alerts delivered to your inbox in real time.
              <span className="block mt-1 text-[10px] text-emerald-300/90">
                LIVE · Resend · throttled to 1 email / 10 min per subscriber
              </span>
              <span className="block mt-0.5 text-[10px] text-amber-300/80">
                Resend test mode delivers only to your registered Resend address until you verify a domain.
              </span>
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {status !== "sent" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5 pt-2"
              >
                <div>
                  <label className="label-overline block mb-2">Email address</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-white/30"
                    data-testid="subscribe-email"
                  />
                </div>

                <div>
                  <label className="label-overline block mb-3">Categories</label>
                  <div className="flex flex-col gap-2.5">
                    {CATEGORY_OPTIONS.map((c) => (
                      <label
                        key={c.key}
                        className="flex items-center justify-between text-sm cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }}
                          />
                          {c.label}
                        </span>
                        <Switch
                          checked={cats[c.key]}
                          onCheckedChange={(v) => setCats({ ...cats, [c.key]: v })}
                          data-testid={`subscribe-cat-${c.key}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label-overline">Min. severity</label>
                    <span
                      className="text-xs font-mono-data uppercase tracking-wider"
                      style={{ color: ["#a1a1aa", "#FFCC00", "#FF9F0A", "#FF3B30"][minSev] }}
                    >
                      {SEV_LABELS[minSev]}
                    </span>
                  </div>
                  <Slider
                    value={[minSev]}
                    min={0}
                    max={3}
                    step={1}
                    onValueChange={(v) => setMinSev(v[0])}
                    data-testid="subscribe-severity"
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-2 sm:flex-row">
                  <Button
                    variant="ghost"
                    onClick={handleSendTest}
                    disabled={status === "sending"}
                    className="text-zinc-400 hover:text-white hover:bg-white/5"
                    data-testid="subscribe-test"
                  >
                    <Send className="w-3.5 h-3.5 mr-2" />
                    Send test
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    onClick={() => handleClose(false)}
                    className="text-zinc-400 hover:text-white hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={status === "sending"}
                    className="bg-white text-black hover:bg-zinc-200 min-w-[120px]"
                    data-testid="subscribe-send"
                  >
                    {status === "sending" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Subscribing…
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5 mr-2" />
                        Subscribe
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </motion.div>
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center text-center"
                data-testid="subscribe-success"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14 }}
                  className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center mb-4"
                >
                  <Check className="w-6 h-6 text-emerald-400" strokeWidth={2.4} />
                </motion.div>
                <div className="font-display text-lg font-semibold mb-1">
                  Subscription active
                </div>
                <div className="text-sm text-zinc-400 mb-1">
                  Confirmation sent to{" "}
                  <span className="text-white font-mono-data text-xs">{sentEmail}</span>
                </div>
                <div className="text-[10px] text-zinc-500 max-w-xs mt-3 leading-relaxed">
                  You'll receive matching alerts in real time. If you don't see the email, check spam — and remember Resend test mode only delivers to your registered Resend address.
                </div>
                <div className="text-[11px] text-zinc-500 font-mono-data mt-3">
                  {new Date().toLocaleTimeString()} · LIVE
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  className="mt-6 bg-white/5 border-white/10 text-white hover:bg-white/10"
                  data-testid="subscribe-done"
                >
                  <X className="w-3.5 h-3.5 mr-2" />
                  Close
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubscribeModal;
