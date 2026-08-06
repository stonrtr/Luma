const letters = ["t", "e", "a", "m", "M"];

export function Logo() {
  return (
    <div
      className="pointer-events-none flex select-none items-baseline"
      aria-label="team M"
    >
      {letters.map((ch, i) => (
        <span
          key={i}
          className="logo-letter font-heading font-bold text-[#b6c56b]"
          style={{
            animationDelay: `${i * 0.15}s`,
            fontSize: ch === "M" ? "1.5rem" : "1.15rem",
            marginLeft: ch === "M" ? "2px" : 0,
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}
