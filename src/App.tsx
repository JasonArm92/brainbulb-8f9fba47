import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WindowManagerProvider } from "./hooks/useWindowManager";
import { Desktop } from "./components/Desktop";
import { Taskbar } from "@/components/Taskbar";
import Index from "./pages/Index";
import { Portfolio } from "./pages/Portfolio";
import { About } from "./pages/About";
import { Pricing } from "./pages/Pricing";
import { Contact } from "./pages/Contact";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <WindowManagerProvider>
          <div className="min-h-screen w-full relative overflow-hidden">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/about" element={<About />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Desktop />
            <Taskbar />
          </div>
        </WindowManagerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;