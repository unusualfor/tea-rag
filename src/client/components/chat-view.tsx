import { useState, useRef, useEffect } from "react";
import type { Tea } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageContent } from "@/components/chat-message-content";
import { Send, RotateCcw, Loader2, Search } from "lucide-react";

const EXAMPLE_QUERIES = [
  "What should I drink this afternoon?",
  "Find a tea similar to gyokuro",
  "Which teas are urgent right now?",
  "Show me everything from China",
];

const TOOL_LABELS: Record<string, string> = {
  list_categories: "Checking collection...",
  list_teas_by_filter: "Filtering teas...",
  search_teas: "Searching...",
  get_tea: "Looking up tea details...",
};

interface ChatViewProps {
  onTeaClick: (tea: Tea) => void;
}

export function ChatView({ onTeaClick }: ChatViewProps) {
  const { messages, isStreaming, currentToolCall, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentToolCall]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const handleExampleClick = (query: string) => {
    sendMessage(query);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-1">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Ask about the collection</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              I can help you find teas, get brewing recommendations, or explore
              what's in the collection.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExampleClick(q)}
                  className="text-sm px-3 py-2 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="space-y-4 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
                      : "text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="text-sm leading-relaxed">
                      {msg.content ? (
                        <ChatMessageContent
                          content={msg.content}
                          onTeaClick={onTeaClick}
                        />
                      ) : isStreaming && msg === messages[messages.length - 1] ? (
                        /* Show tool call indicator or typing cursor */
                        currentToolCall ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-sm">
                              {TOOL_LABELS[currentToolCall] || "Processing..."}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block w-2 h-4 bg-foreground/40 animate-pulse" />
                        )
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background pt-3 pb-1">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the tea collection..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
          {messages.length > 0 && !isStreaming && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearChat}
              title="Clear conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
