import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Child {
  id: string;
  full_name: string;
  grade: string;
  stream: string;
}

interface Props {
  children: Child[];
  activeChildId: string | null;
  onSelect: (id: string) => void;
}

export default function ParentChildSelector({ children, activeChildId, onSelect }: Props) {
  if (children.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {children.map(child => (
        <button
          key={child.id}
          onClick={() => onSelect(child.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition-all",
            activeChildId === child.id
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          <GraduationCap className="h-4 w-4" />
          {child.full_name.split(' ')[0]}
        </button>
      ))}
    </div>
  );
}
