import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Navigation */}
      <nav className="px-2 sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center">
          <div className="flex w-full items-center justify-between">
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">⛅</span>
              <h1 className="text-xl font-bold">Strava Weather</h1>
            </div>

            {/* User Menu */}
            {user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {user.profileImageUrl && (
                    <img
                      src={user.profileImageUrl}
                      alt={user.displayName}
                      className="h-8 w-8 rounded-full ring-2 ring-background"
                    />
                  )}
                  <span className="text-sm font-medium">
                    {user.displayName}
                  </span>
                </div>

                <Button variant="ghost" size="sm" onClick={logout}>
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-6 mx-auto px-3 flex-1">{children}</main>

      {/* Footer  */}
      <footer className="border-t px-2 mt-auto">
        <div className="container flex h-16 items-center py-4">
          <p className="text-sm text-muted-foreground">
            Built by{" "}
            <a
              href="https://www.ngridge.com/en"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4 hover:text-primary"
            >
              James Langridge
            </a>
            . The source code is available on{" "}
            <a
              href="https://github.com/james-langridge/strava-weather"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4 hover:text-primary"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
