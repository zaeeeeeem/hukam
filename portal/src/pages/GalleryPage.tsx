import { ArrowUpRight, FileText, ImageIcon, Images } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/shell/Shell";
import { EmptyState, Img, InlineError, Segmented, Skeleton, TimeAgo } from "../components/ui/primitives";
import { SURFACE } from "../components/ui/surface";
import { bytes, plural } from "../lib/format";
import { Link } from "../lib/router";
import { usePortal } from "../lib/store";
import type { GalleryItem } from "../lib/types";
import { Lightbox } from "./SessionsPage";

type Filter = "all" | "user" | "agent" | "preview";

const SOURCE: Record<GalleryItem["source"], string> = { user: "Sent on WhatsApp", agent: "Made by an agent", preview: "Live preview" };

export function GalleryPage() {
  const { gallery, events } = usePortal();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewer, setViewer] = useState<GalleryItem | null>(null);

  const load = useCallback(() => {
    gallery()
      .then((x) => {
        setItems(x);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [gallery]);
  // Reload when something new could have landed (attachment in, artifact or preview out).
  const lastMedia = [...events].reverse().find((e) => e.type === "artifact" || e.type === "preview" || (e.type === "inbound" && e.attachment))?.id;
  useEffect(load, [load, lastMedia]);

  const count = (f: Filter) => (items ?? []).filter((i) => f === "all" || i.source === f).length;
  const shown = (items ?? []).filter((i) => filter === "all" || i.source === filter);

  return (
    <div className="flex flex-col gap-3 pb-6">
      <PageHeader
        title="Gallery"
        facts={items ? <span>{plural(count("user"), "file")} people sent · {plural(count("agent"), "image")} agents made · {plural(count("preview"), "preview")}</span> : null}
        actions={
          <Segmented
            label="Source"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: count("all") },
              { value: "user", label: "Sent", count: count("user") },
              { value: "agent", label: "Made", count: count("agent") },
              { value: "preview", label: "Previews", count: count("preview") },
            ]}
          />
        }
      />
      {error && !items && <InlineError onRetry={load}>Could not load the gallery. {error}</InlineError>}
      {!items && !error ? (
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-[18px]" />
          ))}
        </div>
      ) : items && shown.length === 0 ? (
        <div className={`rounded-[22px] ${SURFACE}`}>
          <EmptyState icon={Images} title={items.length ? "Nothing in this filter" : "No images yet"}>
            Photos and PDFs people send, images agents make (outputs/) and page screenshots after a change all collect here.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shown.map((it) => (
            <li key={it.url || it.name} className={`group flex min-w-0 flex-col overflow-hidden rounded-[18px] ${SURFACE}`}>
              {it.kind === "pdf" ? (
                <a
                  href={it.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!it.url}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border-b border-white/[0.06] bg-black/30 text-white/60 transition-colors hover:text-white"
                >
                  <FileText className="size-8 text-[#ff9a92]" strokeWidth={1.5} />
                  <span className="flex items-center gap-1 text-[12px]">
                    Open PDF <ArrowUpRight className="size-3.5" />
                  </span>
                </a>
              ) : (
                <button type="button" onClick={() => setViewer(it)} className="block aspect-[4/3] w-full overflow-hidden border-b border-white/[0.06] bg-black/40" aria-label={`View ${it.name}`}>
                  <Img src={it.url} alt={it.name} className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
                </button>
              )}
              <div className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
                <p className="truncate text-[13px] font-medium text-white/90" title={it.name}>
                  {it.source === "preview" && it.session ? `${it.session} preview` : it.name}
                </p>
                <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/45">
                  {it.source === "user" ? <ImageIcon className="size-3 shrink-0" /> : null}
                  <span className="truncate">{SOURCE[it.source]}</span>
                  <span aria-hidden="true">·</span>
                  <TimeAgo at={it.at} className="shrink-0" />
                </p>
                <p className="truncate text-[11px] text-white/35">
                  {it.session ? (
                    <Link to={`/sessions/${encodeURIComponent(it.session)}`} className="text-white/55 transition-colors hover:text-white">
                      {it.session}
                    </Link>
                  ) : it.from ? (
                    `${it.from}${it.chat && it.chat !== "DM" ? ` in ${it.chat}` : ""}`
                  ) : (
                    bytes(it.size)
                  )}
                  {it.text ? ` · “${it.text}”` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {viewer && <Lightbox url={viewer.url} caption={`${viewer.name} · ${SOURCE[viewer.source]}`} onClose={() => setViewer(null)} />}
    </div>
  );
}
