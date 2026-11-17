import type { SVGProps } from "react";

/** Nargile gövdesi, lülesi ve hortumu; mevcut çizgi ikonlarıyla aynı ölçekte. */
export default function HookahIcon({
  size = 24,
  strokeWidth = 1.5,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 3h6l-1 3H9L8 3Zm3 3v8M7 9h8M9 14c0 3-3 3-3 5 0 2 10 2 10 0 0-2-3-2-3-5H9Z" />
      <path d="M14 12c5 0 2 7 5 7 2 0 2-3 2-5V9m-1-2h2v2h-2zM7 22h8" />
    </svg>
  );
}
