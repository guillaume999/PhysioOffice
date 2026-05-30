import { useState, useEffect } from "react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";

interface Popup {
  id: string;
  page_key: string;
  title: string;
  content: string;
  is_active: boolean;
}

export function usePagePopup(pageKey: string) {
  const { user } = useAuth();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPopup = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const items = await pb.collection("admin_popups").getList(1, 1, {
          filter: `page_key = "${pageKey}" && is_active = true`,
        });
        const popupData = items.items[0] ?? null;

        if (!popupData) {
          setPopup(null);
          setLoading(false);
          return;
        }

        setPopup(popupData as unknown as Popup);

        const dismissed = await pb.collection("user_dismissed_popups").getList(1, 1, {
          filter: `popup_id = "${popupData.id}" && user = "${user.id}"`,
        });
        setIsDismissed(dismissed.items.length > 0);
      } catch (err) {
        console.error("Error in usePagePopup:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPopup();
  }, [pageKey, user]);

  const dismissPopup = async (dontShowAgain: boolean) => {
    if (!user || !popup) return;

    if (dontShowAgain) {
      try {
        await pb.collection("user_dismissed_popups").create({
          user: user.id,
          popup_id: popup.id,
        });
      } catch (err) {
        console.error("Error dismissing popup:", err);
      }
    }

    setIsDismissed(true);
  };

  const shouldShowPopup = !loading && popup && !isDismissed;

  return { popup, shouldShowPopup, dismissPopup, loading };
}
