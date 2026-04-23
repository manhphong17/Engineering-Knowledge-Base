"use client";

import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { createPortal } from "react-dom";

type MdxImageProps = ComponentPropsWithoutRef<"img">;

export function MdxImage({ alt, className, src, ...props }: MdxImageProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (typeof src !== "string" || src.length === 0) {
    return null;
  }

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      <img
        src={src}
        alt={alt ?? ""}
        className={`mdx-image-clickable${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        {...props}
      />

      {open &&
        portalTarget &&
        createPortal(
          <div
            className="image-lightbox"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="image-lightbox-close"
              onClick={() => setOpen(false)}
              aria-label="Close image"
            >
              x
            </button>

            <img
              src={src}
              alt={alt ?? ""}
              className="image-lightbox-content"
              onClick={(event) => event.stopPropagation()}
            />
          </div>,
          portalTarget,
        )}
    </>
  );
}
