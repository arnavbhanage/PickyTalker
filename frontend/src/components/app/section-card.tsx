import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  description,
  eyebrow,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={cn("app-section-card", className)}>
      <header className="app-section-heading">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children ? <div className="app-section-content">{children}</div> : null}
    </section>
  );
}
