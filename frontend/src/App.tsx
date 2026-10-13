// src/App.tsx
import React from "react";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppRoutes } from "@/routes/AppRoutes";
import { AuthProvider } from "@/features/auth/components/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";

const App: React.FC = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default App;
