import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  mobileLabel?: string;
};

export default function IconButton({
  icon,
  label,
  mobileLabel,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={[
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-gray-500",
        "transition hover:bg-gray-100 hover:text-gray-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      ].join(" ")}
      {...props}
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {icon}
      </span>
      {mobileLabel ? (
        <span className="text-base font-semibold md:hidden">{mobileLabel}</span>
      ) : null}
    </button>
  );
}

