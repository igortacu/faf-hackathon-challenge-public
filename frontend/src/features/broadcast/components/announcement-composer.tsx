import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePostAnnouncement } from "@/features/broadcast/hooks/use-post-announcement";

export function AnnouncementComposer() {
  const [message, setMessage] = useState("");
  const { publish, isPublishing } = usePostAnnouncement();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) return;

    publish(trimmed, {
      onSuccess: () => setMessage(""),
    });
  }

  return (
    <form
      data-testid="announcement-composer"
      onSubmit={handleSubmit}
      className="mb-3 flex flex-col gap-2 rounded-md border border-dashed border-border bg-accent/30 p-3"
    >
      <Textarea
        data-testid="announcement-message"
        placeholder="Broadcast an announcement to the whole resort..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isPublishing}
        rows={3}
      />
      <Button
        data-testid="announcement-submit"
        type="submit"
        size="sm"
        className="self-end"
        disabled={isPublishing || !message.trim()}
      >
        {isPublishing ? "Broadcasting..." : "Broadcast to resort"}
      </Button>
    </form>
  );
}
