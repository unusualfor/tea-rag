import { useMemo } from "react";
import type { Tea } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { getCategoryGradient, getCountryFlag } from "@/lib/tea-utils";
import teasData from "../../data/teas.json";

const allTeas: Tea[] = teasData as Tea[];

const TEA_REF_REGEX = /\[tea:([a-z0-9-]+)\]/g;

interface TeaReferenceProps {
  id: string;
  onClick: (tea: Tea) => void;
}

function TeaReference({ id, onClick }: TeaReferenceProps) {
  const tea = allTeas.find((t) => t.id === id);
  if (!tea) return <span className="text-muted-foreground">[unknown tea: {id}]</span>;

  const gradient = getCategoryGradient(tea.category);

  return (
    <button
      onClick={() => onClick(tea)}
      className="inline-flex items-center gap-2 my-1 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent transition-colors text-left max-w-sm"
    >
      <div className={`w-8 h-8 rounded bg-gradient-to-br ${gradient} shrink-0`} />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{tea.name.primary}</div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {tea.category_label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {getCountryFlag(tea.origin.country)}
          </span>
        </div>
      </div>
    </button>
  );
}

interface ChatMessageContentProps {
  content: string;
  onTeaClick: (tea: Tea) => void;
}

export function ChatMessageContent({ content, onTeaClick }: ChatMessageContentProps) {
  const segments = useMemo(() => {
    const parts: Array<{ type: "text"; text: string } | { type: "tea"; id: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const regex = new RegExp(TEA_REF_REGEX);
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", text: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: "tea", id: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push({ type: "text", text: content.slice(lastIndex) });
    }
    return parts;
  }, [content]);

  return (
    <div className="space-y-1">
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i} className="whitespace-pre-wrap">{seg.text}</span>
        ) : (
          <TeaReference key={i} id={seg.id} onClick={onTeaClick} />
        )
      )}
    </div>
  );
}
