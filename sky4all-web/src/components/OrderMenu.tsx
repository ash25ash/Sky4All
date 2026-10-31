import { useState } from "react";
import { ArrowLeft, Check, Cookie, CupSoda, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { insert } from "@/lib/ditto";
import { useLang, useT } from "@/lib/i18n";
import cola from "@/assets/menu-coca-cola.jpg";
import fanta from "@/assets/menu-fanta.jpg";
import evian from "@/assets/menu-evian.jpg";
import lays from "@/assets/menu-lays.jpg";
import oreo from "@/assets/menu-oreo.jpg";
import snickers from "@/assets/menu-snickers.jpg";

const products = [
  { name: "Coca-Cola Original", detail: "330 ml", category: "drinks", image: cola },
  { name: "Fanta Orange", detail: "330 ml", category: "drinks", image: fanta },
  { name: "evian", detail: "500 ml", category: "drinks", image: evian },
  { name: "Lay’s Classic", detail: "40 g", category: "snacks", image: lays },
  { name: "Oreo Original", detail: "66 g", category: "snacks", image: oreo },
  { name: "Snickers", detail: "50 g", category: "snacks", image: snickers },
] as const;

export function OrderMenu({ seat, onBack }: { seat: string; onBack: () => void }) {
  const t = useT();
  const ro = useLang() === "ro";
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const items = Object.entries(cart).filter(([, qty]) => qty > 0);
  const count = items.reduce((total, [, qty]) => total + qty, 0);
  const bump = (name: string, delta: number) =>
    setCart((previous) => ({ ...previous, [name]: Math.max(0, (previous[name] ?? 0) + delta) }));

  const send = () => {
    if (!count || sent) return;
    const orderItems = items.map(([name, qty]) => ({ name, qty }));
    insert("orders", { seat, items: orderItems, status: "new", createdAt: Date.now() });
    insert("requests", { type: "order", seat, payload: { items: orderItems }, status: "new", createdAt: Date.now() });
    setSent(true);
  };

  if (sent) return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-card px-5 py-8 text-center" role="status">
      <div className="flex size-14 items-center justify-center rounded-full bg-seat-ok text-seat-ok-foreground"><Check className="size-7" /></div>
      <h2 className="text-lg font-bold">{t("orderSent")}</h2>
      <p className="text-sm text-muted-foreground">{t("yourSeat")} {seat} · {count} {ro ? "produse" : "items"}</p>
      <ul className="w-full divide-y divide-border text-left">{items.map(([name, qty]) => <li key={name} className="flex justify-between gap-3 py-3 text-sm"><span>{name}</span><span className="font-bold">×{qty}</span></li>)}</ul>
      <Button className="w-full" onClick={onBack}><ArrowLeft />{t("back")}</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="px-0 text-primary"><ArrowLeft />{t("back")}</Button>
        <span className="text-xs font-semibold text-muted-foreground">{t("yourSeat")} <span className="text-foreground">{seat}</span></span>
      </div>
      <header>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SKY4ALL · {ro ? "MENIU LA BORD" : "ONBOARD MENU"}</p>
        <h2 className="text-2xl font-extrabold">{ro ? "Gustări și băuturi" : "Snacks & drinks"}</h2>
      </header>
      <div className="flex gap-1 rounded-lg bg-secondary/60 p-1" role="group" aria-label={ro ? "Categorie" : "Category"}>
        {[
          { id: "all", label: ro ? "Toate" : "All", icon: ShoppingBag },
          { id: "drinks", label: ro ? "Băuturi" : "Drinks", icon: CupSoda },
          { id: "snacks", label: ro ? "Gustări" : "Snacks", icon: Cookie },
        ].map(({ id, label, icon: Icon }) => <Button key={id} variant={category === id ? "default" : "ghost"} size="sm" className="min-w-0 flex-1 px-2" aria-pressed={category === id} onClick={() => setCategory(id)}><Icon />{label}</Button>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.filter((product) => category === "all" || product.category === category).map((product) => (
          <article key={product.name} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="aspect-square overflow-hidden bg-product-photo">
              <img src={product.image} alt={`${product.name} ${product.detail}`} width={512} height={512} loading="lazy" className="h-full w-full object-contain transition-transform duration-300 motion-safe:hover:scale-105" />
            </div>
            <div className="flex flex-col gap-2 p-3">
              <h3 className="min-h-10 text-sm font-bold leading-5">{product.name}</h3>
              <p className="text-xs text-muted-foreground">{product.detail}</p>
              <div className="flex items-center justify-between gap-1 border-t border-border pt-2">
                <Button variant="secondary" size="icon" className="size-8 shrink-0" disabled={!cart[product.name]} onClick={() => bump(product.name, -1)} aria-label={`Remove ${product.name}`} title={`Remove ${product.name}`}><Minus /></Button>
                <span className="min-w-5 text-center text-sm font-bold" aria-live="polite">{cart[product.name] ?? 0}</span>
                <Button size="icon" className="size-8 shrink-0" onClick={() => bump(product.name, 1)} aria-label={`Add ${product.name}`} title={`Add ${product.name}`}><Plus /></Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <footer className="sticky bottom-0 z-10 border-t border-border bg-background py-3">
        <Button className="h-12 w-full justify-between px-4 font-bold" disabled={!count} onClick={send}><span className="flex items-center gap-2"><ShoppingBag />{t("sendOrder")}</span><span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground/20 text-xs">{count}</span></Button>
      </footer>
    </div>
  );
}