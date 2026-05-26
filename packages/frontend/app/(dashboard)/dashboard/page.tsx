"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, employeesApi, projectsApi, purchaseOrdersApi } from "@/lib/api";
import { Users, Briefcase, Package, FolderKanban, TrendingUp, Activity, DollarSign, ShoppingCart } from "lucide-react";

export default function DashboardPage() {
  // Fetch dashboard stats from dedicated API
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.getStats(),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => dashboardApi.getRecentActivity(),
  });

  const kpiCards = [
    {
      title: "Total Employees",
      value: statsData?.employees || 0,
      icon: Users,
      color: "blue",
      link: "/hr",
    },
    {
      title: "Active Projects",
      value: statsData?.projects || 0,
      icon: FolderKanban,
      color: "purple",
      link: "/projects",
    },
    {
      title: "Purchase Orders",
      value: statsData?.purchaseOrders || 0,
      icon: ShoppingCart,
      color: "orange",
      link: "/inventory",
    },
    {
      title: "Accounts",
      value: statsData?.accounts || 0,
      icon: DollarSign,
      color: "green",
      link: "/finance",
    },
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
        <p className="text-muted-foreground">
          Welcome to AMDOX ERP - Your complete business management solution
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <a 
            key={index}
            href={kpi.link || '#'}
            className={`rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow ${
              kpi.link ? 'cursor-pointer' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold">
                  {kpi.value}
                </p>
              </div>
              <div className={`p-3 rounded-full ${
                kpi.color === 'blue' ? 'bg-blue-100' :
                kpi.color === 'purple' ? 'bg-purple-100' :
                kpi.color === 'orange' ? 'bg-orange-100' :
                kpi.color === 'green' ? 'bg-green-100' :
                'bg-gray-100'
              }`}>
                <kpi.icon className={`h-6 w-6 ${
                  kpi.color === 'blue' ? 'text-blue-600' :
                  kpi.color === 'purple' ? 'text-purple-600' :
                  kpi.color === 'orange' ? 'text-orange-600' :
                  kpi.color === 'green' ? 'text-green-600' :
                  'text-gray-600'
                }`} />
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <a href="/finance" className="rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">Finance</h3>
              <p className="text-sm text-blue-700">Accounts & Journal</p>
            </div>
          </div>
        </a>
        <a href="/hr" className="rounded-lg border bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Human Resources</h3>
              <p className="text-sm text-green-700">Employees & Leaves</p>
            </div>
          </div>
        </a>
        <a href="/inventory" className="rounded-lg border bg-gradient-to-br from-orange-50 to-orange-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-orange-600" />
            <div>
              <h3 className="font-semibold text-orange-900">Inventory</h3>
              <p className="text-sm text-orange-700">Products & Stock</p>
            </div>
          </div>
        </a>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <a href="/notifications" className="text-sm text-blue-600 hover:underline">View all</a>
        </div>
        <div className="space-y-4">
          {activityLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading activity...</p>
          ) : !activityData || activityData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            activityData.map((activity: any, index: number) => (
              <div key={index} className="flex items-center gap-4 text-sm">
                <div className={`w-2 h-2 rounded-full ${getActivityColor(activity.type)}`} />
                <span className="flex-1">{activity.message}</span>
                <span className="text-xs text-muted-foreground">{formatTime(activity.time)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}