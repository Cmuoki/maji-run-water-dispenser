import { useState, useEffect, useCallback } from "react";
import { WaterDrop } from "./WaterDrop";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Progress } from "./ui/progress";

type Screen = "welcome" | "input" | "payment" | "processing" | "dispensing" | "done";

const RATE_PER_ML = 0.15;
const MAX_LITRES = 5;

export function MajiRunApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [litres, setLitres] = useState(1);
  const [phone, setPhone] = useState("254");
  const [dispenseProgress, setDispenseProgress] = useState(0);
  const [phoneError, setPhoneError] = useState("");

  const costKsh = litres * 1000 * RATE_PER_ML;

  const handlePay = useCallback(async () => {
    if (!/^254\d{9}$/.test(phone)) {
      setPhoneError("Enter a valid phone number (e.g. 254712345678)");
      return;
    }
    setPhoneError("");
    setScreen("processing");

    try {
      const res = await fetch("/api/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          amount: Math.ceil(costKsh),
          litres,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Simulate waiting for M-Pesa callback then dispensing
        setTimeout(() => setScreen("dispensing"), 4000);
      } else {
        // For demo: proceed anyway after delay
        setTimeout(() => setScreen("dispensing"), 4000);
      }
    } catch {
      // For demo: proceed after delay even on error
      setTimeout(() => setScreen("dispensing"), 4000);
    }
  }, [phone, costKsh, litres]);

  useEffect(() => {
    if (screen !== "dispensing") return;
    setDispenseProgress(0);
    const interval = setInterval(() => {
      setDispenseProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => setScreen("done"), 500);
          return 100;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [screen]);

  return (
    <div className="min-h-screen water-bg-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {screen === "welcome" && <WelcomeScreen onStart={() => setScreen("input")} />}
        {screen === "input" && (
          <InputScreen
            litres={litres}
            cost={costKsh}
            onLitresChange={setLitres}
            onNext={() => setScreen("payment")}
            onBack={() => setScreen("welcome")}
          />
        )}
        {screen === "payment" && (
          <PaymentScreen
            cost={costKsh}
            litres={litres}
            phone={phone}
            phoneError={phoneError}
            onPhoneChange={(v) => { setPhone(v); setPhoneError(""); }}
            onPay={handlePay}
            onBack={() => setScreen("input")}
          />
        )}
        {screen === "processing" && <ProcessingScreen />}
        {screen === "dispensing" && <DispensingScreen progress={dispenseProgress} litres={litres} />}
        {screen === "done" && <DoneScreen onRestart={() => { setScreen("welcome"); setLitres(1); setPhone("254"); }} />}
      </div>
    </div>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-center">
        <WaterDrop className="w-20 h-24 animate-float" />
      </div>
      <h1 className="text-3xl font-bold text-foreground">
        Welcome to <span className="text-primary">Maji Run</span>
      </h1>
      <p className="text-muted-foreground">Fresh, clean water at your fingertips.</p>
      <Button
        onClick={onStart}
        className="w-full h-14 text-lg rounded-2xl water-gradient text-primary-foreground font-semibold animate-pulse-glow"
      >
        💧 Start Purchase
      </Button>
    </div>
  );
}

function InputScreen({
  litres, cost, onLitresChange, onNext, onBack,
}: {
  litres: number; cost: number;
  onLitresChange: (v: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
      <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
        ← Back
      </button>
      <h2 className="text-2xl font-bold text-foreground text-center">How many Litres?</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Slider
            value={[litres]}
            onValueChange={([v]) => onLitresChange(v)}
            min={0.5}
            max={MAX_LITRES}
            step={0.5}
            className="flex-1"
          />
          <div className="w-20">
            <Input
              type="number"
              value={litres}
              onChange={(e) => {
                const v = Math.min(MAX_LITRES, Math.max(0.5, Number(e.target.value)));
                onLitresChange(v);
              }}
              min={0.5}
              max={MAX_LITRES}
              step={0.5}
              className="text-center font-bold text-lg"
            />
          </div>
          <span className="text-muted-foreground font-medium">L</span>
        </div>

        <div className="bg-water-surface rounded-2xl p-5 text-center space-y-1">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="text-4xl font-bold text-primary">{cost.toFixed(0)} <span className="text-lg">KSh</span></p>
          <p className="text-xs text-muted-foreground">@ 0.15 KSh/mL • {(litres * 1000).toLocaleString()} mL</p>
        </div>
      </div>

      <Button onClick={onNext} className="w-full h-12 rounded-2xl water-gradient text-primary-foreground font-semibold text-lg">
        Continue to Pay →
      </Button>
    </div>
  );
}

function PaymentScreen({
  cost, litres, phone, phoneError, onPhoneChange, onPay, onBack,
}: {
  cost: number; litres: number; phone: string; phoneError: string;
  onPhoneChange: (v: string) => void; onPay: () => void; onBack: () => void;
}) {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
      <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
        ← Back
      </button>
      <h2 className="text-2xl font-bold text-foreground text-center">Pay with M-Pesa</h2>

      <div className="bg-water-surface rounded-2xl p-4 flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">Amount</p>
          <p className="text-2xl font-bold text-primary">{cost.toFixed(0)} KSh</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Volume</p>
          <p className="text-lg font-semibold text-foreground">{litres} L</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Phone Number</label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="254712345678"
          className="h-12 text-lg rounded-xl"
        />
        {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
        <p className="text-xs text-muted-foreground">Format: 254XXXXXXXXX</p>
      </div>

      <Button onClick={onPay} className="w-full h-14 rounded-2xl bg-success text-success-foreground font-bold text-lg hover:opacity-90 transition-opacity">
        📱 Pay {cost.toFixed(0)} KSh via M-Pesa
      </Button>
    </div>
  );
}

function ProcessingScreen() {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-foreground">Waiting for M-Pesa Payment…</h2>
      <p className="text-muted-foreground text-sm">Check your phone for the STK push prompt.<br />Enter your M-Pesa PIN to confirm.</p>
      <div className="flex justify-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function DispensingScreen({ progress, litres }: { progress: number; litres: number }) {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in fade-in duration-500">
      <WaterDrop className="w-14 h-18 mx-auto animate-float" />
      <h2 className="text-xl font-bold text-foreground">Dispensing Water…</h2>
      <div className="space-y-2">
        <Progress value={progress} className="h-4 rounded-full" />
        <p className="text-sm text-muted-foreground font-medium">{progress}% — {((litres * progress) / 100).toFixed(1)} / {litres} L</p>
      </div>
      <p className="text-primary font-medium">🚰 Please hold your container steady</p>
    </div>
  );
}

function DoneScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-6xl">✅</div>
      <h2 className="text-2xl font-bold text-foreground">Thank You!</h2>
      <p className="text-muted-foreground">Your water has been dispensed. Enjoy your fresh Maji! 💧</p>
      <Button
        onClick={onRestart}
        variant="outline"
        className="w-full h-12 rounded-2xl border-primary text-primary font-semibold text-lg hover:bg-primary/5"
      >
        New Purchase
      </Button>
    </div>
  );
}
