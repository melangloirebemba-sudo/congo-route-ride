import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Bell, BellOff, Smartphone, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWebPushToggle } from "@/hooks/useWebPush";

type Channel = "sms" | "whatsapp";

const Preferences = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const push = useWebPushToggle();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channel, setChannel] = useState<Channel>("sms");
  const [tripReminders, setTripReminders] = useState(true);
  const [cancellationAlerts, setCancellationAlerts] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("channel, trip_reminders, cancellation_alerts")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setChannel(data.channel as Channel);
        setTripReminders(data.trip_reminders);
        setCancellationAlerts(data.cancellation_alerts);
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          channel,
          trip_reminders: tripReminders,
          cancellation_alerts: cancellationAlerts,
        },
        { onConflict: "user_id" }
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Préférences enregistrées");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const ChannelOption = ({
    value,
    icon: Icon,
    title,
    subtitle,
  }: {
    value: Channel;
    icon: typeof Smartphone;
    title: string;
    subtitle: string;
  }) => {
    const selected = channel === value;
    return (
      <button
        type="button"
        onClick={() => setChannel(value)}
        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
          selected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40"
        }`}
      >
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center ${
            selected ? "gradient-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-display font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className={`h-5 w-5 rounded-full border-2 ${
            selected ? "border-primary bg-primary" : "border-border"
          }`}
        />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="gradient-primary px-4 pt-12 pb-8 text-primary-foreground">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold">Préférences</h1>
            <p className="text-xs text-primary-foreground/80">
              Notifications et alertes
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 space-y-4"
        >
          <div>
            <h2 className="font-display font-semibold">Canal de notification</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Comment souhaitez-vous recevoir vos messages ?
            </p>
          </div>
          <div className="space-y-3">
            <ChannelOption
              value="sms"
              icon={Smartphone}
              title="SMS"
              subtitle="Standard, fonctionne sur tous les téléphones"
            />
            <ChannelOption
              value="whatsapp"
              icon={MessageSquare}
              title="WhatsApp"
              subtitle="Plus riche, nécessite une connexion internet"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-5 space-y-4"
        >
          <h2 className="font-display font-semibold">Types d'alertes</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <Label htmlFor="trip-reminders" className="font-medium text-sm">
                  Rappels de voyage
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notification 24h et 1h avant le départ
                </p>
              </div>
              <Switch
                id="trip-reminders"
                checked={tripReminders}
                onCheckedChange={setTripReminders}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <BellOff className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <Label htmlFor="cancel-alerts" className="font-medium text-sm">
                  Alertes d'annulation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Soyez prévenu en cas de changement ou d'annulation
                </p>
              </div>
              <Switch
                id="cancel-alerts"
                checked={cancellationAlerts}
                onCheckedChange={setCancellationAlerts}
              />
            </div>
          </div>
        </motion.div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 gradient-primary text-primary-foreground font-display font-semibold"
        >
          {saving ? "Enregistrement..." : "Enregistrer les préférences"}
        </Button>
      </div>
    </div>
  );
};

export default Preferences;
