"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, GripVertical, X, BarChart3, PieChart, LineChart, Table, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { dashboardApi, productsApi } from "@/lib/api";
import { 
  BarChart, Bar, PieChart as RePieChart, Pie, LineChart as ReLineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";

export type WidgetType = "bar" | "pie" | "line" | "table" | "stat";

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  dataKey?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

const WIDGET_TYPES = [
  { type: "stat" as WidgetType, label: "Metric Card", icon: BarChart3 },
  { type: "bar" as WidgetType, label: "Bar Chart", icon: BarChart3 },
  { type: "pie" as WidgetType, label: "Pie Chart", icon: PieChart },
  { type: "line" as WidgetType, label: "Line Chart", icon: LineChart },
  { type: "table" as WidgetType, label: "Data Table", icon: Table },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardBuilder() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.getStats(),
  });

  const { data: savedLayout, isLoading: layoutLoading } = useQuery({
    queryKey: ["dashboard-layout"],
    queryFn: () => dashboardApi.getLayout(),
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products-top"],
    queryFn: () => productsApi.getAll(),
  });

  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);

  // Initialize widgets from saved layout or defaults
  useEffect(() => {
    if (savedLayout?.layout) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidgets(savedLayout.layout);
    } else if (!layoutLoading && widgets.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidgets([
        { id: "1", type: "stat", title: "Total Employees", dataKey: "employees", position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
        { id: "2", type: "stat", title: "Active Projects", dataKey: "projects", position: { x: 1, y: 0 }, size: { width: 1, height: 1 } },
        { id: "5", type: "stat", title: "Low Stock Items", dataKey: "lowStock", position: { x: 2, y: 0 }, size: { width: 1, height: 1 } },
        { id: "3", type: "bar", title: "Resource Distribution", position: { x: 0, y: 1 }, size: { width: 2, height: 2 } },
        { id: "4", type: "pie", title: "Entity Breakdown", position: { x: 2, y: 1 }, size: { width: 1, height: 2 } },
      ]);
    }
  }, [savedLayout, layoutLoading]);

  const { mutate: saveLayout, isPending: isSaving } = useMutation({
    mutationFn: (newLayout: DashboardWidget[]) => dashboardApi.saveLayout(newLayout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-layout"] });
    },
    onError: () => {
      toast.error("Failed to save layout");
    }
  });

  // Debounced auto-save
  useEffect(() => {
    if (widgets.length === 0 && !savedLayout) return;
    
    const handler = setTimeout(() => {
      // Only save if it's different from what we loaded
      if (JSON.stringify(widgets) !== JSON.stringify(savedLayout?.layout)) {
        saveLayout(widgets);
      }
    }, 2000);

    return () => clearTimeout(handler);
  }, [widgets, saveLayout, savedLayout]);

  const chartData = useMemo(() => [
    { name: 'Employees', value: stats?.employees || 0 },
    { name: 'Projects', value: stats?.projects || 0 },
    { name: 'Accounts', value: stats?.accounts || 0 },
    { name: 'Orders', value: stats?.purchaseOrders || 0 },
    { name: 'Low Stock', value: stats?.lowStock || 0 },
  ], [stats]);

  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const addWidget = useCallback((type: WidgetType) => {
    const newWidget: DashboardWidget = {
      id: Date.now().toString(),
      type,
      title: `New ${WIDGET_TYPES.find(w => w.type === type)?.label || "Widget"}`,
      position: { x: widgets.length % 3, y: Math.floor(widgets.length / 3) + 2 },
      size: { width: 1, height: 1 },
    };
    setWidgets([...widgets, newWidget]);
    setIsAdding(false);
    toast.success("Widget added to workspace");
  }, [widgets]);

  const removeWidget = useCallback((id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
    toast.success("Widget removed");
  }, [widgets]);

  const moveWidget = useCallback((id: string, direction: "left" | "right" | "up" | "down") => {
    setWidgets(widgets.map(w => {
      if (w.id !== id) return w;
      const newPos = { ...w.position };
      if (direction === "left") newPos.x = Math.max(0, newPos.x - 1);
      if (direction === "right") newPos.x = Math.min(2, newPos.x + 1);
      if (direction === "up") newPos.y = Math.max(0, newPos.y - 1);
      if (direction === "down") newPos.y = newPos.y + 1;
      return { ...w, position: newPos };
    }));
  }, [widgets]);

  const renderWidgetContent = (widget: DashboardWidget) => {
    if (statsLoading || layoutLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-6 w-6 text-blue-500" /></div>;

    if (widget.type === "stat") {
      const rawValue = widget.dataKey ? (stats as any)?.[widget.dataKey] : 0;
      const value = (rawValue !== undefined && rawValue !== null) ? rawValue : "0";
      return (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="text-4xl font-bold text-blue-600">{value}</div>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">Live System Data</p>
        </div>
      );
    }

    if (widget.type === "bar") {
      return (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (widget.type === "pie") {
      return (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={chartData}
                innerRadius={40}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (widget.type === "line") {
      return (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (widget.type === "table") {
      const topProducts = products?.slice(0, 5) || [];
      return (
        <div className="w-full overflow-hidden rounded-md border text-xs">
          <table className="w-full text-left">
            <thead className="bg-gray-50 font-bold uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productsLoading ? (
                <tr><td colSpan={3} className="p-4 text-center"><Loader2 className="animate-spin h-4 w-4 mx-auto" /></td></tr>
              ) : topProducts.length > 0 ? (
                topProducts.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium truncate max-w-[100px]">{p.name}</td>
                    <td className="px-3 py-2 text-gray-500">{p.sku}</td>
                    <td className="px-3 py-2 text-right">${Number(p.unitPrice).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No data</td></tr>
              )}
            </tbody>
          </table>
          <div className="bg-gray-50 px-3 py-1 text-[10px] text-muted-foreground text-center border-t">
            Showing top {topProducts.length} entries
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-muted-foreground italic text-sm">
        Unsupported widget type
      </div>
    );
  };

  const rows = widgets.reduce((acc, widget) => {
    const rowIdx = widget.position.y;
    if (!acc[rowIdx]) acc[rowIdx] = [];
    acc[rowIdx].push(widget);
    return acc;
  }, {} as Record<number, DashboardWidget[]>);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Builder</h1>
          <p className="text-muted-foreground">Architect your intelligence workspace with live ERP data</p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && <div className="flex items-center text-xs text-muted-foreground animate-pulse"><Save className="h-3 w-3 mr-1" /> Saving...</div>}
          <Button onClick={() => setIsAdding(!isAdding)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Widget
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Available Components</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {WIDGET_TYPES.map(wt => (
                <Button
                  key={wt.type}
                  variant="outline"
                  className="h-20 flex flex-col gap-2 bg-white hover:border-blue-400 hover:text-blue-600"
                  onClick={() => addWidget(wt.type)}
                >
                  <wt.icon className="h-5 w-5" />
                  <span className="text-[10px] uppercase font-bold tracking-tighter">{wt.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {Object.entries(rows).sort(([a], [b]) => Number(a) - Number(b)).map(([rowIdx, row]) => (
          <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {row.sort((a, b) => a.position.x - b.position.x).map(widget => (
              <Card
                key={widget.id}
                className={`shadow-sm border-gray-200 transition-all ${
                  draggedWidget === widget.id ? 'opacity-50 ring-2 ring-blue-500 shadow-lg scale-95' : 'hover:shadow-md'
                } ${widget.size.width > 1 ? 'md:col-span-2' : ''}`}
                draggable
                onDragStart={() => setDraggedWidget(widget.id)}
                onDragEnd={() => setDraggedWidget(null)}
              >
                <CardHeader className="pb-2 py-3 border-b flex flex-row items-center justify-between space-y-0 bg-gray-50/50">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-600">{widget.title}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white" onClick={() => moveWidget(widget.id, "left")}>
                      <GripVertical className="h-3 w-3 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-50 hover:text-red-500" onClick={() => removeWidget(widget.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {renderWidgetContent(widget)}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>

      {widgets.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-gray-50">
          <p className="text-muted-foreground">Your workspace is empty.</p>
          <Button variant="outline" className="mt-4" onClick={() => setIsAdding(true)}>Create First Widget</Button>
        </div>
      )}
    </div>
  );
}