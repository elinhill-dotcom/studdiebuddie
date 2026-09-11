"use client";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

/** 24-timmars tid (svensk stil) — undviker AM/PM från systemets time-input */
export function TimeInput24({
  value,
  onChange,
  className = "",
}: {
  value: string; // HH:mm
  onChange: (value: string) => void;
  className?: string;
}) {
  const [h = "17", m = "00"] = (value || "17:00").split(":");
  const minuteOptions = MINUTES.includes(m)
    ? MINUTES
    : [...MINUTES, m].sort();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <select
        className="input-field min-w-0 flex-1 py-1.5 text-sm"
        value={h.padStart(2, "0")}
        onChange={(e) => onChange(`${e.target.value}:${m.padStart(2, "0")}`)}
        aria-label="Timme"
      >
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="shrink-0 font-semibold text-muted">:</span>
      <select
        className="input-field min-w-0 flex-1 py-1.5 text-sm"
        value={m.padStart(2, "0")}
        onChange={(e) => onChange(`${h.padStart(2, "0")}:${e.target.value}`)}
        aria-label="Minut"
      >
        {minuteOptions.map((min) => (
          <option key={min} value={min}>
            {min}
          </option>
        ))}
      </select>
    </div>
  );
}
