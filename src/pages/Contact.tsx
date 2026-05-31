import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, MapPin, Phone, Loader2 } from "lucide-react";

export default function Contact() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await pb.collection("contact_messages").create(form);
      toast({ title: "Message envoyé !" });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold mb-4">Contactez-nous</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">Une question ? N'hésitez pas à nous contacter.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card>
            <CardHeader><CardTitle>Envoyez-nous un message</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label>Nom</Label><Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Label>Email</Label><Input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><Label>Sujet</Label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>
                <div><Label>Message</Label><Textarea required rows={4} value={form.message} onChange={e => setForm({...form, message: e.target.value})} /></div>
                <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Envoyer</>}</Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card><CardContent className="flex items-center gap-4 pt-6"><Mail className="w-8 h-8 text-primary" /><div><p className="font-medium">Email</p><p className="text-muted-foreground">contact@physiooffice.fr</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6"><Phone className="w-8 h-8 text-primary" /><div><p className="font-medium">Téléphone</p><p className="text-muted-foreground">01 23 45 67 89</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6"><MapPin className="w-8 h-8 text-primary" /><div><p className="font-medium">Adresse</p><p className="text-muted-foreground">123 Rue de la Santé, 75000 Paris</p></div></CardContent></Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
