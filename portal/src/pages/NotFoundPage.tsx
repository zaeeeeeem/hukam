import { Compass } from "lucide-react";
import { PageHeader } from "../components/shell/Shell";
import { EmptyState } from "../components/ui/primitives";
import { PILL_SM_BUTTON, SURFACE } from "../components/ui/surface";
import { Link } from "../lib/router";

export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Page not found" />
      <div className={`rounded-[22px] ${SURFACE}`}>
        <EmptyState
          icon={Compass}
          title="Nothing lives at this address"
          action={
            <Link to="/" className={PILL_SM_BUTTON}>
              Go to Live
            </Link>
          }
        >
          The link may be from an older version of the dashboard. Everything is reachable from the sidebar.
        </EmptyState>
      </div>
    </div>
  );
}
