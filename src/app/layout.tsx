import "./globals.css";
import AuthNav from "@/components/auth-nav";

export const metadata = {
  title: "일정 도우미",
  description: "일정 도우미"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthNav />
        {children}
      </body>
    </html>
  );
}
