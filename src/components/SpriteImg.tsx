import { useState, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpriteImgProps {
  src: string;
  alt: string;
  /** Tailwind size classes for both the container and shimmer placeholder. Default: "h-10 w-10" */
  size?: string;
  /** Extra classes on the <img> element */
  imgClassName?: string;
  /** Extra classes on the container <div> */
  className?: string;
  /** If the primary src fails, try this URL before giving up (e.g. home sprite fallback). */
  fallbackSrc?: string;
  loading?: "lazy" | "eager";
}

/**
 * Sprite image with a skeleton shimmer placeholder while loading.
 * Shows shimmer → fades in on load. Silently hides the img on error
 * (or retries fallbackSrc first if provided).
 */
export function SpriteImg({
  src,
  alt,
  size = "h-10 w-10",
  imgClassName,
  className,
  fallbackSrc,
  loading = "lazy",
}: SpriteImgProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the image is already cached the browser fires onLoad before React attaches
  // the handler. useLayoutEffect runs before paint so the shimmer never flashes.
  useLayoutEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setStatus("loaded");
    }
  }, []);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setStatus("error");
    }
  };

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", size, className)}>
      {status === "loading" && (
        <div className={cn("absolute skeleton-shimmer rounded", size)} />
      )}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={loading}
        onLoad={() => setStatus("loaded")}
        onError={handleError}
        className={cn(
          "max-h-full w-auto object-contain transition-opacity duration-200",
          status === "loaded" ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
      />
    </div>
  );
}
