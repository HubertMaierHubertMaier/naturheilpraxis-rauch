import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { LoginDisabledBanner } from "@/components/LoginDisabledBanner";

interface LayoutProps {
  children: ReactNode;
  mainAriaLabel?: string;
}

export function Layout({ children, mainAriaLabel }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <LoginDisabledBanner />
      <main className="flex-1" aria-label={mainAriaLabel}>{children}</main>
      <Footer />
    </div>
  );
}
