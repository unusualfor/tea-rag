interface BrewingIndicatorProps {
  detail?: string;
}

export function BrewingIndicator({ detail }: BrewingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Teapot with steam */}
      <div className="relative w-10 h-10">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          className="w-10 h-10 text-muted-foreground"
        >
          {/* Steam lines */}
          <path
            d="M16 12 Q16 8 14 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-steam-1"
            opacity="0.5"
          />
          <path
            d="M22 10 Q22 6 20 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-steam-2"
            opacity="0.5"
          />
          <path
            d="M28 12 Q28 8 26 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-steam-3"
            opacity="0.5"
          />

          {/* Lid knob */}
          <circle cx="22" cy="16" r="2" fill="currentColor" opacity="0.6" />
          {/* Lid */}
          <path
            d="M12 19 H32"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Body */}
          <path
            d="M12 19 C12 19 10 34 14 38 C18 42 28 42 32 38 C34 34 32 19 32 19"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.08"
          />
          {/* Spout */}
          <path
            d="M32 24 C34 23 38 22 40 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Handle */}
          <path
            d="M12 23 C8 23 6 28 8 32 C9 34 12 34 12 33"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Brewing text */}
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground animate-pulse">
          Brewing...
        </span>
        {detail && (
          <span className="text-xs text-muted-foreground/70">{detail}</span>
        )}
      </div>
    </div>
  );
}
