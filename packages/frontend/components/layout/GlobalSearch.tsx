"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, User, Package, Folder, Users, Loader2, Flag, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchApi } from "@/lib/api";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setIsLoading(true);
        try {
          const data = await searchApi.global(query);
          setResults(data);
          setIsOpen(true);
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults(null);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = results && (
    results.users.length > 0 ||
    results.products.length > 0 ||
    results.projects.length > 0 ||
    results.employees.length > 0 ||
    results.milestones?.length > 0 ||
    results.tasks?.length > 0
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'user': return <User className="h-4 w-4" />;
      case 'product': return <Package className="h-4 w-4" />;
      case 'project': return <Folder className="h-4 w-4" />;
      case 'employee': return <Users className="h-4 w-4" />;
      case 'milestone': return <Flag className="h-4 w-4" />;
      case 'task': return <CheckSquare className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md mx-4 hidden md:block">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search everything..."
          className="pl-9 w-full bg-muted/50 focus-visible:bg-background"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
        {isLoading && (
          <div className="absolute right-2.5 top-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border rounded-md shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {!hasResults && !isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          )}

          {results && (
            <div className="p-2">
              {Object.entries(results as Record<string, any[]>).map(([key, items]) => (
                items.length > 0 && (
                  <div key={key} className="mb-2 last:mb-0">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {key}
                    </div>
                    {items.map((item: any) => (
                      <Link
                        key={item.id}
                        href={item.link}
                        className="flex items-center gap-3 px-2 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="flex-shrink-0 text-muted-foreground">
                          {getIcon(item.type)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
