"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, Share2, X, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/*
 * Full-screen document viewer.
 *
 * Modelled on the iOS photo viewer: dark surround so the document is the only
 * lit thing, pinch and wheel zoom, double-tap to toggle fill, drag to pan.
 *
 * The signed URL is fetched when the viewer opens rather than passed in, because
 * these URLs expire in five minutes — minting one per open keeps it valid and
 * keeps every access behind the API's ownership check.
 */

type DocumentViewerProps = {
  documentId: string;
  title: string;
  mimeType: string;
  onClose: () => void;
};

const MAX_SCALE = 5;
const MIN_SCALE = 1;

export function DocumentViewer({
  documentId,
  title,
  mimeType,
  onClose,
}: DocumentViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  /*
   * Mirrors the drag ref as state because the cursor and transition style are
   * decided during render, and a ref's value must not be read there — React can
   * render without the ref reflecting the latest commit.
   */
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
  } | null>(null);
  const pinchState = useRef<{ distance: number; scale: number } | null>(null);

  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/documents/${documentId}/url`);
        if (!response.ok) throw new Error("Could not open this document");
        const data = (await response.json()) as { url: string };
        if (!cancelled) setUrl(data.url);
      } catch {
        if (!cancelled) setError("Could not open this document");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Escape to dismiss, matching what a full-screen overlay implies.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // The body must not scroll behind a full-screen viewer.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function zoomTo(next: number) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    setScale(clamped);
    // Panning is meaningless at fit scale, so recentre when returning to it.
    if (clamped === MIN_SCALE) setOffset({ x: 0, y: 0 });
  }

  async function openSigned(download: boolean) {
    const response = await fetch(
      `/api/documents/${documentId}/url${download ? "?download=true" : ""}`,
    );
    if (!response.ok) return;
    const data = (await response.json()) as { url: string };
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function share() {
    /*
     * Web Share is only available on secure contexts and mostly on mobile. Where
     * it is missing, copying the link is the honest fallback rather than a button
     * that silently does nothing.
     */
    const response = await fetch(`/api/documents/${documentId}/url`);
    if (!response.ok) return;
    const { url: signed } = (await response.json()) as { url: string };
    if (navigator.share) {
      try {
        await navigator.share({ title, url: signed });
        return;
      } catch {
        // User dismissed the sheet; fall through to clipboard.
      }
    }
    await navigator.clipboard?.writeText(signed);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${title}`}
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col bg-slate-950 text-white"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-slate-950/95 px-3 py-3 backdrop-blur sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-white/50">
            {isPdf ? "PDF document" : "Image document"} · private preview
          </p>
        </div>

        {!isPdf ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => zoomTo(scale - 0.5)}
            >
              <ZoomOut />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => zoomTo(scale + 0.5)}
            >
              <ZoomIn />
            </Button>
          </>
        ) : null}

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Share"
          className="text-white hover:bg-white/15 hover:text-white"
          onClick={share}
        >
          <Share2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Download"
          className="text-white hover:bg-white/15 hover:text-white"
          onClick={() => openSigned(true)}
        >
          <Download />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Print"
          className="text-white hover:bg-white/15 hover:text-white"
          onClick={() => openSigned(false)}
        >
          <Printer />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close viewer"
          className="text-white hover:bg-white/15 hover:text-white"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>

      <div
        className="relative m-3 min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black sm:m-5"
        onWheel={(event) => {
          if (isPdf) return;
          event.preventDefault();
          zoomTo(scale + (event.deltaY < 0 ? 0.25 : -0.25));
        }}
        onDoubleClick={() => {
          if (isPdf) return;
          // Toggle between fit and a readable zoom, like the iOS photo viewer.
          if (scale > MIN_SCALE) {
            reset();
          } else {
            zoomTo(2.5);
          }
        }}
        onPointerDown={(event) => {
          if (isPdf || scale === MIN_SCALE) return;
          dragState.current = {
            active: true,
            startX: event.clientX - offset.x,
            startY: event.clientY - offset.y,
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragState.current;
          if (!drag?.active) return;
          setOffset({
            x: event.clientX - drag.startX,
            y: event.clientY - drag.startY,
          });
        }}
        onPointerUp={() => {
          dragState.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          dragState.current = null;
          setDragging(false);
        }}
        onTouchStart={(event) => {
          if (isPdf || event.touches.length !== 2) return;
          const [a, b] = [event.touches[0], event.touches[1]];
          pinchState.current = {
            distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            scale,
          };
        }}
        onTouchMove={(event) => {
          const pinch = pinchState.current;
          if (!pinch || event.touches.length !== 2) return;
          const [a, b] = [event.touches[0], event.touches[1]];
          const distance = Math.hypot(
            a.clientX - b.clientX,
            a.clientY - b.clientY,
          );
          zoomTo((distance / pinch.distance) * pinch.scale);
        }}
        onTouchEnd={() => {
          pinchState.current = null;
        }}
      >
        {error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
            {error}
          </div>
        ) : !url ? (
          <div className="flex h-full items-center justify-center p-3 sm:p-6">
            <Spinner className="size-7 text-white/80" />
          </div>
        ) : isPdf ? (
          /*
           * PDFs render in the browser's own viewer, which already provides
           * paging, zoom and text selection — reimplementing that would be worse
           * than what every browser ships.
           */
          <iframe
            src={url}
            title={title}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed S3 URL, expires in minutes, so it cannot be optimised or cached by next/image */}
            <img
              src={url}
              alt={title}
              draggable={false}
              className="h-full w-full origin-center object-contain select-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                // No easing mid-drag: the image must track the pointer exactly.
                transition: dragging
                  ? "none"
                  : "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                cursor:
                  scale > MIN_SCALE
                    ? dragging
                      ? "grabbing"
                      : "grab"
                    : "zoom-in",
              }}
            />
          </div>
        )}
      </div>

      {!isPdf ? (
        <p className="shrink-0 pb-4 text-center text-xs text-white/45">
          Double-tap to zoom · drag to pan · pinch on touch
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
