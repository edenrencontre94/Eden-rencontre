import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Bell, Tag, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/marketing")({
  component: AdminMarketing,
});

function AdminMarketing() {
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("20");
  const [promoExpiry, setPromoExpiry] = useState("");
  const [sending, setSending] = useState(false);

  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      toast.error("Remplissez le titre et le message");
      return;
    }
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    toast.success(`Notification envoyée à tous les membres ✅`);
    setNotifTitle("");
    setNotifBody("");
    setSending(false);
  };

  const createPromo = async () => {
    if (!promoCode.trim()) {
      toast.error("Entrez un code promo");
      return;
    }
    toast.success(`Code promo "${promoCode.toUpperCase()}" créé avec ${promoDiscount}% de réduction 🎉`);
    setPromoCode("");
    setPromoDiscount("20");
    setPromoExpiry("");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold">Marketing & Communication</h1>
        <p className="text-muted-foreground mt-1">Engagez votre communauté et boostez vos conversions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Push Notification Panel */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">Notification Push Globale</h2>
              <p className="text-xs text-muted-foreground">Envoyée à tous les utilisateurs actifs</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Titre</label>
              <input
                type="text"
                placeholder="Ex : 🎉 Joyeuse Saint-Valentin !"
                value={notifTitle}
                onChange={e => setNotifTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Message</label>
              <textarea
                placeholder="Ex : Profitez de -30% sur l'abonnement Premium aujourd'hui seulement ! ❤️"
                value={notifBody}
                onChange={e => setNotifBody(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
            {/* Preview */}
            {(notifTitle || notifBody) && (
              <div className="bg-secondary rounded-xl p-4 border border-border/40">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Aperçu</p>
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground text-center flex items-center justify-center text-xs font-bold shrink-0">AM</div>
                  <div>
                    <p className="text-sm font-semibold">{notifTitle || "Titre de la notification"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{notifBody || "Corps du message…"}</p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={sendNotification}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? "Envoi en cours…" : "Envoyer à tous les membres"}
            </button>
          </div>
        </div>

        {/* Promo Codes Panel */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">Codes Promo</h2>
              <p className="text-xs text-muted-foreground">Créez des réductions pour vos campagnes</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Code Promo</label>
              <input
                type="text"
                placeholder="Ex : NOEL2026"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Réduction (%)</label>
                <input
                  type="number"
                  min="1" max="100"
                  value={promoDiscount}
                  onChange={e => setPromoDiscount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Date d'expiration</label>
                <input
                  type="date"
                  value={promoExpiry}
                  onChange={e => setPromoExpiry(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <button
              onClick={createPromo}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-gold-foreground font-semibold hover:bg-gold/90 transition-colors"
            >
              <Tag className="w-4 h-4" />
              Créer le code promo
            </button>
          </div>

          {/* Existing Promo codes */}
          <div className="pt-4 border-t border-border/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Codes actifs</p>
            <div className="space-y-2">
              {[
                { code: "WELCOME10", discount: "10%", uses: 142, expiry: "31/12/2026" },
                { code: "AFRIQUE25", discount: "25%", uses: 89, expiry: "15/08/2026" },
              ].map(p => (
                <div key={p.code} className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-2.5">
                  <div>
                    <span className="font-mono font-semibold text-sm text-primary">{p.code}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {p.discount} off</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium">{p.uses} utilisations</div>
                    <div className="text-[10px] text-muted-foreground">exp. {p.expiry}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
