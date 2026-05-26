"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, GripVertical, X, BarChart3, PieChart, LineChart, Table } from "lucide-react";
import { toast } from "sonner";

export type WidgetType = "bar" | "pie" | "line" | "table" | "stat";

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  data: any;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

const WIDGET_TYPES = [
  { type: "bar" as WidgetType, label: "Bar Chart", icon: BarChart3 },
  { type: "pie" as WidgetType, label: "Pie Chart", icon: PieChart },
  { type: "line" as WidgetType, label: "Line Chart", icon: LineChart },
  { type: "table" as WidgetType, label: "Data Table", icon: Table },
];

export default function DashboardBuilder() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([
    { id: "1", type: "stat", title: "Total Revenue", data: { value: "$125,000", change: "+12%" }, position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
    { id: "2", type: "stat", title: "Active Projects", data: { value: "24", change: "+3" }, position: { x: 1, y: 0 }, size: { width: 1, height: 1 } },
    { id: "3", type: "bar", title: "Monthly Sales", data: {}, position: { x: 0, y: 1 }, size: { width: 2, height: 1 } },
    { id: "4", type: "pie", title: "Department Distribution", data: {}, position: { x: 2, y: 0 }, size: { width: 1, height: 2 } },
  ]);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const addWidget = useCallback((type: WidgetType) => {
    const newWidget: DashboardWidget = {
      id: Date.now().toString(),
      type,
      title: `New ${WIDGET_TYPES.find(w => w.type === type)?.label || "Widget"}`,
      data: {},
      position: { x: widgets.length % 3, y: Math.floor(widgets.length / 3) },
      size: { width: 1, height: 1 },
    };
    setWidgets([...widgets, newWidget]);
    setIsAdding(false);
    toast.success("Widget added");
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

  const getWidgetIcon = (type: WidgetType) => {
    switch (type) {
      case "bar": return <BarChart3 className="h-8 w-8 text-blue-500" />;
      case "pie": return <PieChart className="h-8 w-8 text-green-500" />;
      case "line": return <LineChart className="h-8 w-8 text-purple-500" />;
      case "table": return <Table className="h-8 w-8 text-orange-500" />;
      default: return <BarChart3 className="h-8 w-8 text-gray-500" />;
    }
  };

  const renderWidgetContent = (widget: DashboardWidget) => {
    if (widget.type === "stat") {
      return (
        <div className="text-center">
          <div className="text-3xl font-bold">{widget.data.value}</div>
          <div className="text-sm text-green-600">{widget.data.change}</div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {getWidgetIcon(widget.type)}
      </div>
    );
  };

  // Group widgets by row for grid display
  const rows = widgets.reduce((acc, widget) => {
    const rowIdx = widget.position.y;
    if (!acc[rowIdx]) acc[rowIdx] = [];
    acc[rowIdx].push(widget);
    return acc;
  }, {} as Record<number, DashboardWidget[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Builder</h1>
          <p className="text-muted-foreground">Drag and drop widgets to customize your view</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Widget
        </Button>
      </div>

      {isAdding && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Select Widget Type</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {WIDGET_TYPES.map(wt => (
                <Button
                  key={wt.type}
                  variant="outline"
                  className="h-20 flex flex-col gap-2"
                  onClick={() => addWidget(wt.type)}
                >
                  <wt.icon className="h-6 w-6" />
                  <span className="text-xs">{wt.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {Object.values(rows).map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-3 gap-4">
            {row.map(widget => (
              <Card
                key={widget.id}
                className={`min-h-[160px] ${draggedWidget === widget.id ? 'ring-2 ring-blue-500' : ''}`}
                draggable
                onDragStart={() => setDraggedWidget(widget.id)}
                onDragEnd={() => setDraggedWidget(null)}
              >
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveWidget(widget.id, "left")}>
                      <GripVertical className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeWidget(widget.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {renderWidgetContent(widget)}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>

      {widgets.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No widgets yet. Click "Add Widget" to get started.
        </div>
      )}
    </div>
  );
}