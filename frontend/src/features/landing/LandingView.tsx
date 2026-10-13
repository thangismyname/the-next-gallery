import { LandingHeader } from "./components/LandingHeader";
import { Hero } from "./components/Hero";
import { ContactSheetGallery } from "./components/ContactSheetGallery";
import { CapabilitiesList } from "./components/CapabilitiesList";
import { ClosingStatement } from "./components/ClosingStatement";
import { LandingFooter } from "./components/LandingFooter";

export default function LandingView() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <LandingHeader />
      <main>
        <Hero />
        <ContactSheetGallery />
        <CapabilitiesList />
        <ClosingStatement />
        <LandingFooter />
      </main>
      {/* Footer: chưa làm */}
    </div>
  );
}
