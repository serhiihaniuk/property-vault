import { Badge } from "@/src/shared/ui/badge";
import { Button } from "@/src/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

const capabilityLabels = [
  "Dashboard",
  "Documents",
  "Financials",
  "Settings",
] as const;

const implementationPanels = [
  {
    title: "Serious structure first",
    description:
      "The route shell is thin again, while views and widgets now carry the product-specific screen composition.",
  },
  {
    title: "Private by default",
    description:
      "The shell is ready for invite-only auth and later provider wiring without teaching components to orchestrate infrastructure.",
  },
  {
    title: "Prepared for live data",
    description:
      "The next tasks can focus on providers, REST handlers, and vertical slices instead of reshaping the UI boundary again.",
  },
] as const;

export function DashboardOverviewWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Vault</CardTitle>
        <CardDescription>
          Contract-first workspace for evidence-backed property operations.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          This shell is intentionally light on chrome: the route group gives the
          dashboard a stable frame, while page and widget layers own the
          product-specific surfaces that later tasks will connect to real data.
        </p>
        <div className="flex flex-wrap gap-2">
          {capabilityLabels.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
        <Separator />
        <div className="grid gap-4 lg:grid-cols-3">
          {implementationPanels.map(({ title, description }) => (
            <Card key={title} size="sm">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3 max-md:flex-col max-md:items-start">
        <p className="text-sm text-muted-foreground">
          The dashboard slice can now grow without putting product chrome back
          into `shared`.
        </p>
        <Button type="button" variant="outline" disabled>
          Data wiring next
        </Button>
      </CardFooter>
    </Card>
  );
}
