import * as React from "react";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
}

const ImageWithFallback = React.forwardRef<HTMLImageElement, ImageWithFallbackProps>(
  ({ src, alt, className, fallbackClassName, onError, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);

    const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setHasError(true);
      setIsLoading(false);
      console.warn(`Image failed to load: ${alt || "unnamed image"}`);
      onError?.(e);
    };

    const handleLoad = () => {
      setIsLoading(false);
    };

    if (hasError) {
      return (
        <div
          className={cn(
            "flex items-center justify-center bg-muted/50 text-muted-foreground rounded",
            className,
            fallbackClassName
          )}
          role="img"
          aria-label={alt || "Image unavailable"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-1/3 h-1/3 max-w-8 max-h-8 opacity-40"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </div>
      );
    }

    return (
      <>
        {isLoading && (
          <div
            className={cn(
              "animate-pulse bg-muted/50 rounded absolute inset-0",
              className
            )}
          />
        )}
        <img
          ref={ref}
          src={src}
          alt={alt}
          className={cn(isLoading && "opacity-0", className)}
          onError={handleError}
          onLoad={handleLoad}
          {...props}
        />
      </>
    );
  }
);

ImageWithFallback.displayName = "ImageWithFallback";

export { ImageWithFallback };
