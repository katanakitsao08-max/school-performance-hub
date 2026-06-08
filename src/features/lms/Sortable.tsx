import { ReactNode } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type SortableItem = { id: string; [k: string]: any };

/** Persist sort_order in batch. */
export async function persistOrder(table: string, ids: string[]) {
  await Promise.all(
    ids.map((id, i) =>
      (supabase as any).from(table).update({ sort_order: i }).eq("id", id)
    )
  );
}

export function SortableList<T extends SortableItem>({
  items, onReorder, render,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  render: (item: T, handle: ReactNode) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === active.id);
    const newIdx = items.findIndex(i => i.id === over.id);
    onReorder(arrayMove(items, oldIdx, newIdx));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(item => <SortableRow key={item.id} id={item.id} render={(handle) => render(item, handle)} />)}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, render }: { id: string; render: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const handle = (
    <button ref={setNodeRef as any} {...attributes} {...listeners}
      className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground"
      aria-label="Drag to reorder" type="button">
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return <div ref={setNodeRef} style={style}>{render(handle)}</div>;
}
