"use client";

import { useSearchParams } from "next/navigation";
import { AccountPage } from "@/components/account/account-page";
import { OfficePage } from "@/components/admin-app/office";
import { PeoplePage } from "@/components/admin-app/people";
import { PublishPage } from "@/components/admin-app/publish";
import { SpeakUpPage as AdminSpeakUpPage } from "@/components/admin-app/speak-up";
import { TodayPage } from "@/components/admin-app/today";
import { SnackProvider } from "@/components/admin-app/ui";
import { WifiPage as AdminWifiPage } from "@/components/admin-app/wifi";
import { DaysPage } from "@/components/days/days-page";
import { EventPage } from "@/components/feed/event-page";
import { FeedPage } from "@/components/feed/feed-page";
import { HelpPage } from "@/components/help/help-page";
import { WorkspaceLink } from "@/components/m3/workspace-link";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { SnacksPage } from "@/components/snacks/snacks-page";
import { SpeakUpPage } from "@/components/speak-up/speak-up-page";
import { StepsPage } from "@/components/steps/steps-page";
import { WifiPage } from "@/components/wifi/wifi-page";
import { adminPaths, workspacePath } from "@/lib/workspace-navigation";
import { HomePage } from "./home-page";

const adminTools = [
  ["admin-today", "Today", TodayPage],
  ["admin-people", "People", PeoplePage],
  ["admin-speak-up", "Speak up inbox", AdminSpeakUpPage],
  ["admin-publish", "Publish", PublishPage],
  ["admin-office", "Office", OfficePage],
  ["admin-wifi", "Wi-Fi reports", AdminWifiPage],
] as const;

export function HomeWorkspace({ name, firstName, isAdmin }: { name: string; firstName: string; isAdmin: boolean }) {
  const params = useSearchParams();
  const view = params.get("view");
  const event = params.get("event");
  const tool = adminTools.find(([id]) => id === view);
  const AdminTool = isAdmin ? tool?.[2] : undefined;
  const overview = workspacePath(view) === "/" || (!!tool && !isAdmin);
  const content = (() => {
    switch (view) {
      case "days": return <DaysPage />;
      case "feed": return <FeedPage />;
      case "event": return event ? <EventPage key={event} id={event} /> : <FeedPage />;
      case "snacks": return <SnacksPage />;
      case "steps": return <StepsPage />;
      case "wifi": return <WifiPage />;
      case "notifications": return <NotificationsPage />;
      case "account": return <AccountPage />;
      case "help": return <HelpPage />;
      case "speak-up": return <SpeakUpPage name={name} />;
      default: return <HomePage firstName={firstName} />;
    }
  })();

  return (
    <div className={`m3 m3-page m3-workspace${AdminTool ? " m3-workspace-admin" : overview ? " m3-workspace-overview" : ""}`}>
      <nav aria-label="Workspace" className="m3-workspace-nav">
        <WorkspaceLink href="/" aria-current={overview ? "page" : undefined}>Home</WorkspaceLink>
        <WorkspaceLink href="/feed" aria-current={view === "feed" || view === "event" ? "page" : undefined}>Feed</WorkspaceLink>
        <WorkspaceLink href="/days" aria-current={view === "days" ? "page" : undefined}>Days</WorkspaceLink>
        <WorkspaceLink href="/snacks" aria-current={view === "snacks" ? "page" : undefined}>Tea &amp; snacks</WorkspaceLink>
        <WorkspaceLink href="/steps" aria-current={view === "steps" ? "page" : undefined}>10K steps</WorkspaceLink>
        <WorkspaceLink href="/wifi" aria-current={view === "wifi" ? "page" : undefined}>Wi-Fi</WorkspaceLink>
        <WorkspaceLink href="/grievances" aria-current={view === "speak-up" ? "page" : undefined}>Speak up</WorkspaceLink>
        <WorkspaceLink href="/notifications" aria-current={view === "notifications" ? "page" : undefined}>Notifications</WorkspaceLink>
        <WorkspaceLink href="/account" aria-current={view === "account" ? "page" : undefined}>Account</WorkspaceLink>
        <WorkspaceLink href="/help" aria-current={view === "help" ? "page" : undefined}>Help</WorkspaceLink>
        {isAdmin && <WorkspaceLink href="/admin" aria-current={AdminTool ? "page" : undefined}>Admin</WorkspaceLink>}
      </nav>
      {AdminTool ? (
        <section aria-label="Admin tools" className="m3-workspace-tools">
          <nav aria-label="Admin tools" className="m3-workspace-nav">
            {adminTools.map(([id, label]) => <WorkspaceLink key={id} href={adminPaths[id]} aria-current={id === view ? "page" : undefined}>{label}</WorkspaceLink>)}
          </nav>
          <SnackProvider><AdminTool /></SnackProvider>
        </section>
      ) : content}
    </div>
  );
}
