"use client"

import { useState } from "react"
import { Check, LockKeyhole, Save, UserRound } from "lucide-react"
import { Field, PageHeading, Panel } from "@/components/analytics/analytics-ui"

const initialProfile = {
  name: "Brew Admin",
  email: "admin@brewco.com",
  business: "Brew & Co. Coffee",
}

export default function SettingsPage() {
  const [profile, setProfile] = useState(initialProfile)
  const [saved, setSaved] = useState(false)
  const [digest, setDigest] = useState(true)

  function update(key: keyof typeof initialProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  return (
    <>
      <PageHeading eyebrow="Workspace" title="Settings" description="Manage the profile and preferences for this admin workspace." />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:flex-col">
          <a href="#profile" className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground"><UserRound className="size-4" /> Profile</a>
          <a href="#preferences" className="flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"><Check className="size-4" /> Preferences</a>
          <a href="#security" className="flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"><LockKeyhole className="size-4" /> Security</a>
        </nav>
        <div className="space-y-5">
          <Panel title="Profile information" description="Basic information for your BrewAnalytics workspace.">
            <div id="profile" className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name" value={profile.name} onChange={(event) => update("name", event.target.value)} />
              <Field label="Email address" type="email" value={profile.email} onChange={(event) => update("email", event.target.value)} />
              <Field label="Business name" value={profile.business} onChange={(event) => update("business", event.target.value)} className="sm:col-span-2" />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p role="status" className="text-xs text-muted-foreground">{saved ? "Preview preferences updated locally. Nothing was sent to a server." : "Changes are kept in this page preview only."}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setProfile(initialProfile); setSaved(false) }} className="h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Reset</button>
                <button type="button" onClick={() => setSaved(true)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Save className="size-4" /> Save preview</button>
              </div>
            </div>
          </Panel>
          <Panel title="Account preferences" description="Choose how this preview presents your workspace.">
            <div id="preferences" className="flex items-center justify-between gap-5">
              <div><p className="text-sm font-medium">Weekly analytics summary</p><p className="mt-1 text-xs text-muted-foreground">Show an in-product reminder to review weekly performance.</p></div>
              <button type="button" role="switch" aria-checked={digest} onClick={() => setDigest((enabled) => !enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${digest ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${digest ? "translate-x-6" : "translate-x-1"}`} /></button>
            </div>
          </Panel>
          <Panel title="Security" description="Account security controls will be connected with authentication in a future phase.">
            <div id="security" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-medium">Password</p><p className="mt-1 text-xs text-muted-foreground">Password changes are not available in this static interface.</p></div>
              <button type="button" disabled className="h-9 rounded-lg border border-input px-3 text-sm font-medium opacity-50">Change password</button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}