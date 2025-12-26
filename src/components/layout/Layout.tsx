import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
    </div>
  );
}
