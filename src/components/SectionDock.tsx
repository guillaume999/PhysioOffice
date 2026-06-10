import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Users, Brain, FileText, Calendar, Dumbbell, ClipboardList,
  Video, Activity, Newspaper, Megaphone, GraduationCap, BookOpen,
  Briefcase, Stethoscope, Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MAX_SCALE = 1.2;
const RANGE = 64;

interface SubItem {
  title: string;
  icon: LucideIcon;
  href: string;
}

interface Section {
  label: string;
  icon: LucideIcon;
  accent: string;
  items: SubItem[];
}

const sections: Section[] = [
  {
    label: "Cabinet",
    icon: Briefcase,
    accent: "text-primary",
    items: [
      { title: "Patients", icon: Users, href: "/patients" },
      { title: "Notes", icon: FileText, href: "/notes" },
      { title: "Planning", icon: Calendar, href: "/planning" },
      { title: "IA Diagnostic", icon: Brain, href: "/ia-diagnostic" },
    ],
  },
  {
    label: "Rééducation",
    icon: Stethoscope,
    accent: "text-violet-500",
    items: [
      { title: "Exercices", icon: Dumbbell, href: "/exercices" },
      { title: "Traitements", icon: ClipboardList, href: "/traitement-type" },
      { title: "Séances", icon: ClipboardList, href: "/seance-type" },
      { title: "Vidéos", icon: Video, href: "/videos" },
      { title: "Pathologies", icon: Activity, href: "/pathologies" },
    ],
  },
  {
    label: "Communauté",
    icon: Globe,
    accent: "text-teal-500",
    items: [
      { title: "Actualités", icon: Newspaper, href: "/news" },
      { title: "Annonces", icon: Megaphone, href: "/annonces" },
      { title: "Formation", icon: GraduationCap, href: "/formation" },
      { title: "Annuaire", icon: BookOpen, href: "/annuaire" },
    ],
  },
];

function applyMag(refs: React.MutableRefObject<(HTMLDivElement | null)[]>, clientX: number) {
  refs.current.forEach((ref) => {
    if (!ref) return;
    const rect = ref.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const distance = Math.abs(clientX - center);
    const scale = 1 + (MAX_SCALE - 1) * Math.max(0, 1 - distance / RANGE);
    ref.style.transform = `scale(${scale})`;
  });
}

function resetMag(refs: React.MutableRefObject<(HTMLDivElement | null)[]>) {
  refs.current.forEach((ref) => {
    if (!ref) return;
    ref.style.transform = "scale(1)";
  });
}

export function SectionDock() {
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const subRefs0 = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const subRefs1 = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const subRefs2 = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const allSubRefs = [subRefs0, subRefs1, subRefs2];

  const clearLeave = () => clearTimeout(leaveTimer.current);
  const startLeave = () => {
    leaveTimer.current = setTimeout(() => setActiveSection(null), 250);
  };

  return (
    <div
      className="hidden md:flex flex-col items-center gap-3 fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none will-change-transform"
      onMouseEnter={clearLeave}
      onMouseLeave={startLeave}
    >
      {/* Subsection row — reserved height, one set visible at a time */}
      <div className="relative h-20 w-full flex justify-center items-end">
        {sections.map((section, si) => {
          const subRefs = allSubRefs[si];
          return (
            <div
              key={section.label}
              className={`absolute bottom-0 flex items-end gap-4 transition-all duration-250 ${
                activeSection === si
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1 pointer-events-none"
              }`}
              onMouseMove={(e) => applyMag(subRefs, e.clientX)}
              onMouseLeave={() => resetMag(subRefs)}
            >
              {section.items.map((item, ii) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.href}
                    ref={(el) => { subRefs.current[ii] = el; }}
                    style={{ transformOrigin: "bottom center", transition: "transform 0.12s ease" }}
                  >
                    <Link to={item.href} className="flex flex-col items-center gap-1.5 group">
                      <span className="text-[11px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {item.title}
                      </span>
                      <div className={`w-10 h-10 rounded-xl bg-background/95 border border-border/60 shadow-sm flex items-center justify-center ${section.accent}`}>
                        <Icon className="w-[18px] h-[18px]" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Thin separator */}
      <div className={`w-48 h-px bg-border/40 transition-opacity duration-300 ${activeSection !== null ? "opacity-100" : "opacity-0"}`} />

      {/* Section icons */}
      <div
        className="flex items-end gap-10"
        onMouseMove={(e) => applyMag(sectionRefs, e.clientX)}
        onMouseLeave={() => resetMag(sectionRefs)}
      >
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <div
              key={section.label}
              ref={(el) => { sectionRefs.current[i] = el; }}
              onMouseEnter={() => {
                clearTimeout(leaveTimer.current);
                setActiveSection(i);
              }}
              className="flex flex-col items-center gap-1.5 cursor-pointer"
              style={{ transformOrigin: "bottom center", transition: "transform 0.12s ease" }}
            >
              <div className={`w-12 h-12 rounded-xl bg-background/95 border border-border/60 shadow-sm flex items-center justify-center ${section.accent}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{section.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
