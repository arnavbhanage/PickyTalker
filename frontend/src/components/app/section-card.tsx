import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className={cn("app-section-card", className)}>
      <CardHeader className="app-section-heading">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description ? (
          <CardDescription>
            <p>{description}</p>
          </CardDescription>
        ) : null}
      </CardHeader>
      {children ? <CardContent className="app-section-content">{children}</CardContent> : null}
    </Card>
  );
}
