import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { Logo } from "../components/ui/Logo";

const features = [
  {
    label: "Rankings",
    title: "Open, competitive bidding",
    description:
      "Suppliers see live rankings — L1, L2, L3 — and can lower their price at any time before close.",
  },
  {
    label: "Extensions",
    title: "Anti-sniping by design",
    description:
      "A bid placed near the close automatically extends the auction, so nobody wins by sneaking in a last-second offer.",
  },
  {
    label: "Rules",
    title: "Configurable per auction",
    description:
      "Buyers set the trigger window, extension length, and exactly what counts as competitive activity.",
  },
  {
    label: "Audit",
    title: "Full activity trail",
    description:
      "Every bid and every extension is logged with a plain-language reason, visible to buyers and suppliers alike.",
  },
];

type Bid = { rank: 1 | 2 | 3; supplier: string; amount: number; you?: boolean };

const INITIAL_BIDS: Bid[] = [
  { rank: 1, supplier: "Meridian Logistics", amount: 18420 },
  { rank: 2, supplier: "Anchor Freight Co.", amount: 18650 },
  { rank: 3, supplier: "Portside Carriers", amount: 18900 },
];

const SNIPE_BID: Bid = { rank: 1, supplier: "Anchor Freight Co.", amount: 18180 };
const CYCLE_START = 14; // seconds shown at the top of each loop
const TRIGGER_WINDOW = 5; // extension fires if a bid lands at or below this
const MAX_ROWS = 3; // hard cap — the ladder only ever shows top 3, no matter what

function formatUSD(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Live-simulated bid ladder: countdown runs down, a challenger snipes near
 *  zero, the clock visibly extends, then the cycle resets. Capped to
 *  MAX_ROWS so the list can never grow past the top 3 — a fresh cycle
 *  always replaces state wholesale rather than appending to it. */
function BidLadder() {
  const [seconds, setSeconds] = useState(CYCLE_START);
  const [bids, setBids] = useState<Bid[]>(INITIAL_BIDS);
  const [extended, setExtended] = useState(false);
  const hasSniped = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // guard against a duplicate interval (e.g. StrictMode double-invoke)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (!hasSniped.current && s === TRIGGER_WINDOW) {
          hasSniped.current = true;
          setBids(([SNIPE_BID, { ...INITIAL_BIDS[0], rank: 2 }, { ...INITIAL_BIDS[1], rank: 3 }] as Bid[]).slice(0, MAX_ROWS));
          setExtended(true);
          return CYCLE_START;
        }
        if (s <= 1) {
          hasSniped.current = false;
          setExtended(false);
          setBids(INITIAL_BIDS.slice(0, MAX_ROWS));
          return CYCLE_START;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, []);

  const low = seconds <= TRIGGER_WINDOW;

  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">RFQ-2291 · Chicago–Dallas, FTL</p>
          <p className="text-sm font-semibold text-slate-900">Live bid ladder</p>
        </div>
        <div className="flex flex-col items-end">
          <span
            className={`font-mono text-lg font-semibold tabular-nums transition-colors ${
              low ? "text-[#B5760E]" : "text-slate-900"
            }`}
          >
            00:{String(seconds).padStart(2, "0")}
          </span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest transition-opacity ${
              extended ? "text-[#16A34A] opacity-100" : "opacity-0"
            }`}
          >
            +0:14 extended
          </span>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {bids.slice(0, MAX_ROWS).map((bid) => (
          <li
            key={bid.rank}
            className="flex items-center justify-between px-5 py-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-semibold ${
                  bid.rank === 1
                    ? "bg-[#F5A524] text-[#3D2600]"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                L{bid.rank}
              </span>
              <span className="text-sm text-slate-700">{bid.supplier}</span>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
              {formatUSD(bid.amount)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5">
        <p className="text-[11px] text-slate-500">
          Bid landed inside the trigger window — close time extended automatically.
        </p>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="border-b border-slate-200 bg-[#FAFAF8]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-tight text-slate-900">BidFlow</span>
          </div>
          <Link to="/login">
            <Button variant="secondary" size="sm">
              Log in
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#FAFAF8]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.4]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F5A524]/30 bg-[#FAEEDA] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#B5760E]">
              British-auction RFQ engine
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              Every bid pushes
              <br />
              the price down.
              <br />
              <span className="text-slate-400">In full view.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
              Post an RFQ, let suppliers bid openly and drive costs down in real time.
              Built-in anti-sniping extensions mean a last-second bid never decides the
              auction — it just buys everyone else more time to respond.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login">
                <Button size="md">Log in to get started</Button>
              </Link>
              <span className="text-xs text-slate-400">No card required to explore a demo auction.</span>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <BidLadder />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-lg">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#B5760E]">
            How it holds up
          </span>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Fairness isn't a promise. It's a mechanism.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="border-slate-200">
              <CardBody>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B5760E]">
                  {feature.label}
                </span>
                <h3 className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-slate-400">
          BidFlow — a demo British Auction RFQ platform built for the GoComet Full Stack Intern
          assignment.
        </div>
      </footer>
    </div>
  );
}