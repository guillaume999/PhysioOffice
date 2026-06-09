import { ReactNode } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

type Variant = "up" | "left" | "right" | "scale" | "fade";
type Delay = 0 | 100 | 200 | 300 | 400 | 500;

interface ScrollRevealProps {
  children: ReactNode;
  variant?: Variant;
  delay?: Delay;
  className?: string;
}

const variantClass: Record<Variant, string> = {
  up: "reveal-up",
  left: "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
  fade: "",
};

const delayClass: Record<number, string> = {
  0: "",
  100: "reveal-delay-100",
  200: "reveal-delay-200",
  300: "reveal-delay-300",
  400: "reveal-delay-400",
  500: "reveal-delay-500",
};

export function ScrollReveal({
  children,
  variant = "up",
  delay = 0,
  className,
}: ScrollRevealProps) {
  const ref = useScrollReveal();

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={cn("reveal", variantClass[variant], delayClass[delay], className)}
    >
      {children}
    </div>
  );
}
