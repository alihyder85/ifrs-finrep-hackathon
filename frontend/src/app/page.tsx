import Link from "next/link";
import { FileSpreadsheet, MessageSquare, Tag, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CAPABILITIES = [
  {
    icon: FileSpreadsheet,
    title: "Import Statements",
    description:
      "Upload Excel-based financial statements. Source system row codes are preserved throughout.",
  },
  {
    icon: Tag,
    title: "Reference Tagging",
    description:
      "Attach reference labels (A1, C1.1, M1.8, …) to individual rows for review workflows.",
  },
  {
    icon: MessageSquare,
    title: "Row Commentary",
    description:
      "Add and edit analyst commentary anchored to a stable row identity, not just position.",
  },
  {
    icon: Download,
    title: "Export Reviews",
    description:
      "Export reviewed commentary with full source lineage in CSV or Excel format.",
  },
];

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      {/* App identity */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Internal Tool
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
          FinRep Review
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Finance reporting review and commentary system. Import structured
          financial statements, annotate rows with references and commentary,
          and export auditable review packages.
        </p>
      </div>

      {/* Primary action */}
      <div className="mb-12">
        <Link href="/reports">
          <Button size="lg" className="mr-3">
            Go to Reports
          </Button>
        </Link>
      </div>

      {/* Capabilities overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CAPABILITIES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="border shadow-none">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
