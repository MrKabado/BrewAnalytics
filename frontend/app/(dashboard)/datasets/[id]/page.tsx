"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CalendarDays, FileSpreadsheet, Rows3 } from "lucide-react"
import { Badge, EmptyState, PageHeading, Panel, StatCard } from "@/components/analytics/analytics-ui"
import { datasets, formatCurrency, recordsPreview } from "@/lib/mock-data"

export default function DatasetDetailPage() {
  const params = useParams<{ id: string }>()
  const dataset = datasets.find((item) => item.id === params.id)

  if (!dataset) {
    return (
      <>
        <PageHeading title="Dataset not found" description="This sample dataset is not available in the current preview." actions={<Link href="/datasets" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" /> Back to datasets</Link>} />
        <Panel><EmptyState icon={FileSpreadsheet} title="No matching dataset" description="Return to the dataset list to select an available sample." /></Panel>
      </>
    )
  }

  return (
    <>
      <PageHeading
        eyebrow="Datasets · Details"
        title={dataset.name}
        description={dataset.fileName}
        actions={<Link href="/datasets" className="inline-flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"><ArrowLeft className="size-4" /> All datasets</Link>}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Sales records" value={dataset.records.toLocaleString()} detail="Imported rows" icon={Rows3} />
        <StatCard label="Dataset status" value={dataset.status} detail="Sample preview state" icon={FileSpreadsheet} />
        <StatCard label="Uploaded" value={dataset.uploadedAt} detail="Sample upload date" icon={CalendarDays} />
      </div>
      <Panel title="Dataset metadata" description="Information about this sample upload">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Dataset name</p><p className="mt-1 text-sm font-medium">{dataset.name}</p></div>
          <div><p className="text-xs text-muted-foreground">Original file</p><p className="mt-1 break-all text-sm font-medium">{dataset.fileName}</p></div>
          <div><p className="text-xs text-muted-foreground">Records</p><p className="mt-1 text-sm font-medium">{dataset.records.toLocaleString()}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><div className="mt-1"><Badge tone="success">{dataset.status}</Badge></div></div>
        </div>
      </Panel>
      <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Sample summary" description="Illustrative metrics from sample data">
          <div className="space-y-4">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total revenue</span><span className="font-semibold">{formatCurrency(42680)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Units sold</span><span className="font-semibold">8,240</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Transactions</span><span className="font-semibold">4,186</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Average transaction</span><span className="font-semibold">$10.20</span></div>
          </div>
        </Panel>
        <Panel title="Record preview" description="First few rows from this sample dataset">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-2 font-medium">Transaction</th><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Product</th><th className="pb-2 text-right font-medium">Qty</th><th className="pb-2 text-right font-medium">Amount</th></tr></thead>
              <tbody className="divide-y divide-border">
                {recordsPreview.map((record) => <tr key={record.transaction}><td className="py-2.5 font-medium">{record.transaction}</td><td className="py-2.5 text-muted-foreground">{record.date}</td><td className="py-2.5">{record.product}</td><td className="py-2.5 text-right">{record.quantity}</td><td className="py-2.5 text-right">{formatCurrency(record.amount)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">All values shown are static sample data. No database records are read or modified.</p>
    </>
  )
}