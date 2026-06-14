import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";
import { DevUserSwitcher } from "@/components/dev/DevUserSwitcher";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-0">
        <div key={pathname} className="animate-page-in">
          {children}
        </div>
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
      <DevUserSwitcher />
    </div>
  );
}
