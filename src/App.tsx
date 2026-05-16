import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import AppRoutes from '@/routes/AppRoutes';

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="auth-ui-theme">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors closeButton expand />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

