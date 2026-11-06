"use client";

import { useMemo, useState } from "react";
import { fmtNum } from "@/lib/format";
import type { Indicator } from "@/lib/types";

type Unit = { code: string; name: string; cop: number };

function buildUnits(find: (id: string) => Indicator | undefined, useTrm: boolean): Unit[] {
  const val = (id: string) => {
    const i = find(id);
    return i?.ok && i.value ? i.value : null;
  };
  const usd = useTrm ? val("trm") ?? val("usdcop") : val("usdcop") ?? val("trm");
  const units: Unit[] = [{ code: "COP", name: "Peso colombiano", cop: 1 }];
  const add = (code: string, name: string, cop: number | null) => {
    if (cop) units.push({ code, name, cop });
  };
  add("USD", "Dólar", usd);
  if (usd) {
    const eurusd = val("eurusd");
    const usdchf = val("usdchf");
    const usdmxn = val("usdmxn");
    const usdbrl = val("usdbrl");
    add("EUR", "Euro", eurusd && usd * eurusd);
    add("CHF", "Franco suizo", usdchf && usd / usdchf);
    add("MXN", "Peso mexicano", usdmxn && usd / usdmxn);
    add("BRL", "Real", usdbrl && usd / usdbrl);
  }
  add("UVR", "Unidad de Valor Real", val("uvr"));
  add("SMMLV", "Salarios mínimos", val("smmlv"));
  return units;
}

export function Converter({ find }: { find: (id: string) => Indicator | undefined }) {
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("COP");
  const [useTrm, setUseTrm] = useState(true);

  const units = useMemo(() => buildUnits(find, useTrm), [find, useTrm]);
  const fromUnit = units.find((u) => u.code === from);
  const toUnit = units.find((u) => u.code === to);

  // Admite la coma decimal y el punto como separador de miles.
  const parsed = Number(amount.replace(/\./g, "").replace(",", "."));
  const result =
    fromUnit && toUnit && Number.isFinite(parsed) ? (parsed * fromUnit.cop) / toUnit.cop : null;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const fieldClass =
    "min-w-0 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink";

  return (
    <section aria-labelledby="conv-title" className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="conv-title" className="text-sm font-semibold">
          Conversor
        </h2>
        <div role="group" aria-label="Tasa del dólar" className="flex text-[11px]">
          {[
            { on: true, label: "TRM" },
            { on: false, label: "Spot" },
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => setUseTrm(o.on)}
              aria-pressed={useTrm === o.on}
              className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                useTrm === o.on ? "bg-accent-wash text-accent" : "text-ink-3 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Monto"
          className={`${fieldClass} tabular-nums`}
        />
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Convertir desde"
          className={fieldClass}
        >
          {units.map((u) => (
            <option key={u.code} value={u.code}>
              {u.code}
            </option>
          ))}
        </select>
        <output className="truncate rounded-lg px-2 py-1.5 text-lg font-semibold tabular-nums tracking-tight">
          {result === null ? "—" : fmtNum(result, Math.abs(result) < 100 ? 4 : 2)}
        </output>
        <div className="flex items-center gap-1">
          <button
            onClick={swap}
            aria-label="Intercambiar monedas"
            className="rounded-md px-1 text-ink-3 transition-colors hover:text-ink"
          >
            ⇅
          </button>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Convertir a"
            className={`${fieldClass} flex-1`}
          >
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
