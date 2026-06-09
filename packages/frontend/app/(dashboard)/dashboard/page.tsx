"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, forecastApi } from "@/lib/api";
import { Users, Package, FolderKanban, DollarSign, ShoppingCart, BrainCircuit, Loader2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { WidgetErrorBoundary } from "@/components/ui/WidgetErrorBoundary";

export default function DashboardPage() {
  const [selectedSku] = useState<string>("LAP-001");

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.getStats(),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => dashboardApi.getRecentActivity(),
  });

  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ["dashboard-forecast", selectedSku],
    queryFn: () => forecastApi.getForecast(selectedSku),
  });

  const kpiCards = [
    { title: "Total Employees", value: statsData?.employees || 0, icon: Users, color: "blue", link: "/hr" },
    { title: "Active Projects", value: statsData?.projects || 0, icon: FolderKanban, color: "purple", link: "/projects" },
    { title: "Purchase Orders", value: statsData?.purchaseOrders || 0, icon: ShoppingCart, color: "orange", link: "/supply-chain" },
    { title: "Accounts", value: statsData?.accounts || 0, icon: DollarSign, color: "green", link: "/finance" },
  ];

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'PROJECT': return 'bg-purple-500';
      case 'PO': return 'bg-orange-500';
      case 'USER': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to AMDOX ERP - Your complete business management solution</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <a key={index} href={kpi.link} className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold">{statsLoading ? '...' : kpi.value}</p>
              </div>
              <div className={`p-3 rounded-full bg-${kpi.color}-100`}>
                <kpi.icon className={`h-6 w-6 text-${kpi.color}-600`} />
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* AI Forecast */}
        <WidgetErrorBoundary title="AI Forecast">
          <div className="rounded-lg border bg-white p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-purple-600" />
                AI Demand Forecast
              </h2>
              <div className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
                Trend: {forecastData?.trend || 'Stable'}
              </div>
            </div>
            <div className="h-[250px] w-full">
              {forecastLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-200" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData?.forecasts || []}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Area type="monotone" dataKey="predicted" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorForecast)" name="Predicted Units" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs text-muted-foreground">
              <span>Powered by AMDOX Intelligence</span>
              <a href="/inventory" className="text-blue-600 hover:underline">Analyze Inventory</a>
            </div>
          </div>
        </WidgetErrorBoundary>

        {/* Recent Activity */}
        <WidgetErrorBoundary title="Recent Activity">
          <div className="rounded-lg border bg-white p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <a href="/notifications" className="text-sm text-blue-600 hover:underline">View all</a>
            </div>
            <div className="space-y-4">
              {activityLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : !activityData || activityData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                activityData.slice(0, 8).map((activity: any, index: number) => (
                  <div key={index} className="flex items-center gap-4 text-sm border-b border-gray-50 pb-2 last:border-0">
                    <div className={`w-2 h-2 rounded-full ${getActivityColor(activity.type)}`} />
                    <span className="flex-1 truncate">{activity.message}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(activity.time)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
