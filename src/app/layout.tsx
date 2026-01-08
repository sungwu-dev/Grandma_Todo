import "./globals.css";

export const metadata = {
  title: "초간단 일정 안내",
  description: "할머니를 위한 초간단 일정 안내"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
