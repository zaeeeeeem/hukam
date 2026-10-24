import { useEffect } from "react";
import { Shell } from "./components/shell/Shell";
import { match, usePath } from "./lib/router";
import { LivePage } from "./pages/LivePage";
import { SessionsPage, SessionDetailPage } from "./pages/SessionsPage";
import { ChatsPage } from "./pages/ChatsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { GalleryPage } from "./pages/GalleryPage";
import { UseCasesPage } from "./pages/UseCasesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemPage } from "./pages/SystemPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const TITLES: Record<string, string> = {
  "/": "Live",
  "/sessions": "Agents",
  "/chats": "Chats",
  "/approvals": "Approvals",
  "/gallery": "Gallery",
  "/use-cases": "Use cases",
  "/settings": "Settings",
  "/system": "System",
};

function route(path: string) {
  let p: Record<string, string> | null;
  if (path === "/" || path === "") return <LivePage />;
  if (path === "/sessions") return <SessionsPage />;
  if ((p = match("/sessions/:name", path))) return <SessionDetailPage name={p.name} />;
  if (path === "/chats") return <ChatsPage />;
  if ((p = match("/chats/:id", path))) return <ChatsPage id={p.id} />;
  if (path === "/approvals") return <ApprovalsPage />;
  if (path === "/gallery") return <GalleryPage />;
  if (path === "/use-cases") return <UseCasesPage />;
  if (path === "/settings") return <SettingsPage />;
  if (path === "/system") return <SystemPage />;
  return <NotFoundPage />;
}

export function App() {
  const raw = usePath();
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  useEffect(() => {
    const base = "/" + (path.split("/")[1] ?? "");
    const title = TITLES[base] ?? (path.startsWith("/sessions/") ? decodeURIComponent(path.split("/")[2] ?? "") : "Not found");
    document.title = `${title} · Hukam`;
  }, [path]);
  return <Shell>{route(path)}</Shell>;
}
