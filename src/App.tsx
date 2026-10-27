import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import DomainCheckup from "./pages/DomainCheckup";
import ClaudeReviewUpload from "./pages/ClaudeReviewUpload";
import ReviewView from "./pages/ReviewView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/domain-checkup" element={<DomainCheckup />} />
          <Route path="/audits" element={<ClaudeReviewUpload />} />
          {/* Old address of the same tab */}
          <Route path="/claude-review-upload" element={<Navigate to="/audits" replace />} />
          {/* Public client-facing review pages: example.com/<slug> */}
          <Route path="/:slug" element={<ReviewView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
