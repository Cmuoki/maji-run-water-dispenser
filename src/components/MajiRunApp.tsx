import { useState, useEffect, useCallback } from "react";
import { WaterDrop } from "./WaterDrop";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Progress } from "./ui/progress";

type Screen = "welcome" | "input" | "payment" | "processing" | "dispensing" | "done" | "admin";

export function MajiRunApp() {
  const [screen, setScreen]                     = useState<Screen>("welcome");
  const [litres, setLitres]                     = useState(1);
  const [phone, setPhone]                       = useState("254");
  const [dispenseProgress, setDispenseProgress] = useState(0);
  const [phoneError, setPhoneError]             = useState("");
  const [pricePerLitre, setPricePerLitre]       = useState(150);
  const [maxLitres, setMaxLitres]               = useState(5);

  // Fetch current settings on load
  useEffect(() => {
    fetch("http://127.0.0.1:8000/price")
      .then(res => res.json())
      .then(data => {
        setPricePerLitre(data.price_per_litre);
        setMaxLitres(data.max_litres);
      })
      .catch(() => {});
  }, []);

  const costKsh = litres * pricePerLitre;

  const handlePay = useCallback(async () => {
    if (!/^254\d{9}$/.test(phone)) {
      setPhoneError("Enter a valid phone number (e.g. 254712345678)");
      return;
    }
    setPhoneError("");
    setScreen("processing");

    try {
      const res = await fetch("http://127.0.0.1:8000/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, amount: Math.ceil(costKsh), litres }),
      });
      const data = await res.json();

      if (data.ResponseCode === "0") {
        const checkoutId = data.CheckoutRequestID;
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await fetch("http://127.0.0.1:8000/payment-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checkout_id: checkoutId }),
            });
            const status = await statusRes.json();
            if (status.paid === true) {
              clearInterval(poll);
              setScreen("dispensing");
            } else if (status.paid === false && status.cancelled) {
              clearInterval(poll);
              setScreen("payment");
              setPhoneError("Payment cancelled. Please try again.");
            }
          } catch { }
          if (attempts >= 20) {
            clearInterval(poll);
            setScreen("payment");
            setPhoneError("Payment timed out. Please try again.");
          }
        }, 3000);
      } else {
        setScreen("payment");
        setPhoneError("Failed to send STK push. Try again.");
      }
    } catch {
      setScreen("payment");
      setPhoneError("Cannot connect to server. Is Flask running?");
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
        {screen === "welcome" && (
          <WelcomeScreen
            onStart={() => setScreen("input")}
            onAdmin={() => setScreen("admin")}
          />
        )}
        {screen === "input" && (
          <InputScreen
            litres={litres}
            cost={costKsh}
            pricePerLitre={pricePerLitre}
            maxLitres={maxLitres}
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
        {screen === "dispensing" && (
          <DispensingScreen progress={dispenseProgress} litres={litres} />
        )}
        {screen === "done" && (
          <DoneScreen onRestart={() => {
            setScreen("welcome");
            setLitres(1);
            setPhone("254");
          }} />
        )}
        {screen === "admin" && (
          <AdminScreen
            currentPrice={pricePerLitre}
            currentMaxLitres={maxLitres}
            onPriceUpdate={(newPrice) => setPricePerLitre(newPrice)}
            onMaxLitresUpdate={(newMax) => setMaxLitres(newMax)}
            onBack={() => setScreen("welcome")}
          />
        )}
      </div>
    </div>
  );
}

// ================= WELCOME SCREEN =================
function WelcomeScreen({ onStart, onAdmin }: {
  onStart: () => void;
  onAdmin: () => void;
}) {
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
      <button
        onClick={onAdmin}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        ⚙️ Admin Settings
      </button>
    </div>
  );
}

// ================= INPUT SCREEN =================
function InputScreen({ litres, cost, pricePerLitre, maxLitres, onLitresChange, onNext, onBack }: {
  litres: number; cost: number; pricePerLitre: number; maxLitres: number;
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
            max={maxLitres}
            step={0.5}
            className="flex-1"
          />
          <div className="w-20">
            <Input
              type="number"
              value={litres}
              onChange={(e) => {
                const v = Math.min(maxLitres, Math.max(0.5, Number(e.target.value)));
                onLitresChange(v);
              }}
              min={0.5}
              max={maxLitres}
              step={0.5}
              className="text-center font-bold text-lg"
            />
          </div>
          <span className="text-muted-foreground font-medium">L</span>
        </div>
        <div className="bg-water-surface rounded-2xl p-5 text-center space-y-1">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="text-4xl font-bold text-primary">{cost.toFixed(0)} <span className="text-lg">KSh</span></p>
          <p className="text-xs text-muted-foreground">@ {pricePerLitre} KSh/L • {(litres * 1000).toLocaleString()} mL</p>
        </div>
      </div>
      <Button onClick={onNext} className="w-full h-12 rounded-2xl water-gradient text-primary-foreground font-semibold text-lg">
        Continue to Pay →
      </Button>
    </div>
  );
}

// ================= PAYMENT SCREEN =================
function PaymentScreen({ cost, litres, phone, phoneError, onPhoneChange, onPay, onBack }: {
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

// ================= ADMIN SCREEN =================
function AdminScreen({ currentPrice, currentMaxLitres, onPriceUpdate, onMaxLitresUpdate, onBack }: {
  currentPrice: number;
  currentMaxLitres: number;
  onPriceUpdate: (price: number) => void;
  onMaxLitresUpdate: (max: number) => void;
  onBack: () => void;
}) {
  const [password, setPassword]         = useState("");
  const [newPrice, setNewPrice]         = useState(String(currentPrice));
  const [newMaxLitres, setNewMaxLitres] = useState(String(currentMaxLitres));
  const [message, setMessage]           = useState("");
  const [isError, setIsError]           = useState(false);
  const [unlocked, setUnlocked]         = useState(false);
  const [checking, setChecking]         = useState(false);

  const handleUnlock = async () => {
    setChecking(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/admin/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          price_per_litre: currentPrice,
          max_litres:      currentMaxLitres
        }),
      });
      if (res.status === 401) {
        setIsError(true);
        setMessage("❌ Wrong password.");
      } else {
        setUnlocked(true);
        setIsError(false);
        setMessage("");
      }
    } catch {
      setIsError(true);
      setMessage("❌ Cannot connect to server.");
    }
    setChecking(false);
  };

  const handleUpdateSettings = async () => {
    const price = parseFloat(newPrice);
    const max   = parseFloat(newMaxLitres);

    if (isNaN(price) || price <= 0) {
      setIsError(true);
      setMessage("❌ Enter a valid price.");
      return;
    }
    if (isNaN(max) || max <= 0) {
      setIsError(true);
      setMessage("❌ Enter a valid max litres.");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/admin/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          price_per_litre: price,
          max_litres:      max
        }),
      });
      const data = await res.json();
      if (data.success) {
        onPriceUpdate(data.price_per_litre);
        onMaxLitresUpdate(data.max_litres);
        setIsError(false);
        setMessage(`✅ Saved! KSh ${data.price_per_litre}/L | Max ${data.max_litres}L`);

        // Go back to home after 1.5 seconds
        setTimeout(() => {
          onBack();
        }, 1500);
      } else {
        setIsError(true);
        setMessage("❌ Update failed.");
      }
    } catch {
      setIsError(true);
      setMessage("❌ Cannot connect to server.");
    }
  };

  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 space-y-6 animate-in fade-in duration-500">
      <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
        ← Back
      </button>
      <h2 className="text-2xl font-bold text-foreground text-center">⚙️ Admin Settings</h2>

      {!unlocked ? (
        // PASSWORD GATE
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">Enter admin password to continue</p>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="h-12 text-lg rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          />
          {message && (
            <p className={`text-sm ${isError ? "text-destructive" : "text-green-600"}`}>
              {message}
            </p>
          )}
          <Button
            onClick={handleUnlock}
            disabled={checking}
            className="w-full h-12 rounded-2xl water-gradient text-primary-foreground font-semibold"
          >
            {checking ? "Checking..." : "🔐 Unlock"}
          </Button>
        </div>
      ) : (
        // ADMIN PANEL
        <div className="space-y-4">

          {/* CURRENT SETTINGS */}
          <div className="bg-water-surface rounded-2xl p-4 flex justify-between items-center">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground">Current Price</p>
              <p className="text-2xl font-bold text-primary">KSh {currentPrice}<span className="text-sm">/L</span></p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground">Max Litres</p>
              <p className="text-2xl font-bold text-primary">{currentMaxLitres}<span className="text-sm">L</span></p>
            </div>
          </div>

          {/* PRICE INPUT */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New Price per Litre (KSh)</label>
            <Input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="e.g. 150"
              className="h-12 text-lg rounded-xl"
              min={1}
            />
          </div>

          {/* MAX LITRES INPUT */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Max Litres per Purchase</label>
            <Input
              type="number"
              value={newMaxLitres}
              onChange={(e) => setNewMaxLitres(e.target.value)}
              placeholder="e.g. 5"
              className="h-12 text-lg rounded-xl"
              min={0.5}
              step={0.5}
            />
          </div>

          {message && (
            <p className={`text-sm text-center font-medium ${isError ? "text-destructive" : "text-green-600"}`}>
              {message}
            </p>
          )}

          <Button
            onClick={handleUpdateSettings}
            className="w-full h-12 rounded-2xl bg-success text-success-foreground font-bold text-lg"
          >
            💾 Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}

// ================= PROCESSING SCREEN =================
function ProcessingScreen() {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Waiting for M-Pesa Payment…</h2>
      <p className="text-muted-foreground text-sm">
        Check your phone for the STK push prompt.<br />Enter your M-Pesa PIN to confirm.
      </p>
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

// ================= DISPENSING SCREEN =================
function DispensingScreen({ progress, litres }: { progress: number; litres: number }) {
  return (
    <div className="bg-card rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in fade-in duration-500">
      <WaterDrop className="w-14 h-18 mx-auto animate-float" />
      <h2 className="text-xl font-bold text-foreground">Dispensing Water…</h2>
      <div className="space-y-2">
        <Progress value={progress} className="h-4 rounded-full" />
        <p className="text-sm text-muted-foreground font-medium">
          {progress}% — {((litres * progress) / 100).toFixed(1)} / {litres} L
        </p>
      </div>
      <p className="text-primary font-medium">🚰 Please hold your container steady</p>
    </div>
  );
}

// ================= DONE SCREEN =================
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