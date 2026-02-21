import type { ReactNode } from "react";

type ContainerMode = "default" | "elder" | "family" | "admin";

const MODE_CLASS: Record<ContainerMode, string> = {
  default: "",
  elder: "max-w-5xl",
  family: "max-w-4xl",
  admin: "max-w-6xl"
};

type ContainerProps = {
  children: ReactNode;
  className?: string;
  mode?: ContainerMode;
};

export default function Container({
  children,
  className = "",
  mode = "default"
}: ContainerProps) {
  return (
    <div
      className={[
        "w-full px-4 md:px-4 lg:px-8",
        "xl:mx-auto xl:max-w-6xl",
        MODE_CLASS[mode],
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

