import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useManageActivities } from "@/features/beach/hooks/use-manage-activities";

const EMPTY_FORM = { id: "", name: "", description: "", capacity: "" };

export function AddActivityForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const { create, isCreating } = useManageActivities();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const capacity = Number(form.capacity);
    if (!form.id.trim() || !form.name.trim() || !Number.isInteger(capacity) || capacity <= 0) {
      return;
    }

    create(
      {
        id: form.id.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        capacity,
      },
      { onSuccess: () => setForm(EMPTY_FORM) }
    );
  }

  return (
    <form
      data-testid="add-activity-form"
      onSubmit={handleSubmit}
      className="mb-3 flex flex-col gap-2 rounded-md border border-dashed border-border bg-accent/30 p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <Input
          data-testid="add-activity-id"
          placeholder="id (e.g. sunset-kayak)"
          value={form.id}
          onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
          disabled={isCreating}
        />
        <Input
          data-testid="add-activity-capacity"
          type="number"
          min={1}
          placeholder="capacity"
          value={form.capacity}
          onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
          disabled={isCreating}
        />
      </div>
      <Input
        data-testid="add-activity-name"
        placeholder="Activity name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        disabled={isCreating}
      />
      <Input
        data-testid="add-activity-description"
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        disabled={isCreating}
      />
      <Button
        data-testid="add-activity-submit"
        type="submit"
        size="sm"
        className="self-end"
        disabled={isCreating}
      >
        {isCreating ? "Adding..." : "Add activity"}
      </Button>
    </form>
  );
}
