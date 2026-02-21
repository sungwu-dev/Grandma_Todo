import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonVariant = "primary" | "neutral" | "danger";

const VARIANT_CLASS: Record<PrimaryButtonVariant, string> = {
  primary:
    "border-amber-600 bg-amber-600 text-white hover:bg-amber-700 hover:border-amber-700",
  neutral:
    "border-gray-300 bg-white text-gray-800 hover:bg-gray-100 hover:border-gray-400",
  danger: "border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700"
};

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: PrimaryButtonVariant;
};

export default function PrimaryButton({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex min-h-12 items-center justify-center rounded-lg border px-4 py-3",
        "text-xl font-semibold leading-none transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASS[variant],
        className
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

