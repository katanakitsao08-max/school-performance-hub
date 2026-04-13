import { useState } from "react";
import { Plus, ClipboardList, CalendarCheck, GraduationCap, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const actions = [
  { label: "Enter Marks", icon: ClipboardList, to: "/marks-entry", color: "bg-primary" },
  { label: "Attendance", icon: CalendarCheck, to: "/attendance", color: "bg-info" },
  { label: "Add Learner", icon: GraduationCap, to: "/learners", color: "bg-accent" },
];

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 md:hidden no-print">
      {open && (
        <>
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
          <div className="relative z-50 flex flex-col items-end gap-2.5 animate-fade-in">
            {actions.map((action) => (
              <button
                key={action.to}
                onClick={() => { setOpen(false); navigate(action.to); }}
                className="flex items-center gap-3 group"
              >
                <span className="text-xs font-semibold bg-card text-foreground px-3 py-1.5 rounded-full shadow-md border border-border">
                  {action.label}
                </span>
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg",
                  action.color
                )}>
                  <action.icon className="h-5 w-5" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200",
          open
            ? "bg-muted-foreground rotate-0"
            : "bg-primary gradient-primary"
        )}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Plus className="h-6 w-6 text-primary-foreground" />
        )}
      </button>
    </div>
  );
}
