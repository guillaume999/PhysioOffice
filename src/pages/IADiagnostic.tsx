import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, Send, Loader2, Bot, User } from "lucide-react";
import { PagePopup } from "@/components/popup/PagePopup";

interface Message { role: "user" | "assistant"; content: string; }

export default function IADiagnostic() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      // AI chat backend. Configure VITE_AI_CHAT_URL to your endpoint; defaults to a
      // PocketBase custom route (`/api/ai-chat`). The PB auth token is forwarded.
      const aiChatUrl = import.meta.env.VITE_AI_CHAT_URL || `${pb.baseURL}/api/ai-chat`;
      const resp = await fetch(aiChatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pb.authStore.token ? { Authorization: pb.authStore.token } : {}),
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erreur");
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) return <Layout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout>
      <PagePopup pageKey="ia-diagnostic" />
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-emerald-500/10"><Brain className="w-6 h-6 text-emerald-500" /></div>
          <div><h1 className="text-2xl md:text-3xl font-display font-bold">IA Diagnostic</h1><p className="text-muted-foreground">Assistant IA pour l'analyse des symptômes</p></div>
        </div>
        <Card className="h-[60vh] flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && <div className="flex items-center justify-center h-full text-muted-foreground">Décrivez les symptômes pour commencer</div>}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-emerald-500" /></div>}
                <div className={`max-w-[80%] p-3 rounded-xl ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                </div>
                {m.role === "user" && <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-primary" /></div>}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center"><Loader2 className="w-4 h-4 text-emerald-500 animate-spin" /></div></div>}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea placeholder="Décrivez les symptômes..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} className="min-h-[60px] resize-none" />
              <Button onClick={sendMessage} disabled={isLoading || !input.trim()} className="gradient-primary text-primary-foreground"><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
