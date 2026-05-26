"use client";

import { useState, useMemo } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";

interface GanttChartProps {
  tasks?: Record<string, any>[];
  projects?: Record<string, any>[];
}

export function GanttChart({ tasks = [], projects = [] }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);

  const ganttTasks: Task[] = useMemo(() => {
    const now = new Date();
    // If we have projects and no specific tasks, show projects as bars
    if (projects.length > 0 && tasks.length === 0) {
      return projects.map((p) => {
        const start = p.startDate ? new Date(p.startDate as string) : now;
        const end = p.endDate ? new Date(p.endDate as string) : new Date(start.getTime() + 86400000 * 30);
        return {
          start,
          end,
          name: p.name as string,
          id: p.id as string,
          type: "project" as const,
          progress: (p.progress as number) || 0,
          styles: { progressColor: "#3b82f6", progressSelectedColor: "#2563eb" },
        };
      });
    }

    // If we have tasks, show them
    if (tasks.length > 0) {
      return tasks.map((t) => {
        const start = t.startDate ? new Date(t.startDate as string) : new Date((t.createdAt as string) || now);
        const end = t.dueDate ? new Date(t.dueDate as string) : new Date(start.getTime() + 86400000);
        return {
          start,
          end,
          name: t.title as string,
          id: t.id as string,
          type: "task" as const,
          progress: t.status === "COMPLETED" ? 100 : 0,
          dependencies: (t.dependencies as any[])?.map((d: any) => d.prerequisiteTaskId as string) || [],
          styles: { 
            progressColor: t.status === "COMPLETED" ? "#22c55e" : "#f59e0b", 
            progressSelectedColor: t.status === "COMPLETED" ? "#16a34a" : "#d97706" 
          },
        };
      });
    }

    // Default empty state or fallback mock if absolutely nothing
    return [];
  }, [tasks, projects]);

  if (ganttTasks.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
        No schedule data available to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <select 
          className="text-sm border rounded px-2 py-1"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
        >
          <option value={ViewMode.Day}>Day</option>
          <option value={ViewMode.Week}>Week</option>
          <option value={ViewMode.Month}>Month</option>
        </select>
      </div>
      <div className="h-[500px] overflow-auto border rounded-lg bg-white">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          listCellWidth="155px"
          columnWidth={60}
          barCornerRadius={4}
          barFill={60}
          handleWidth={8}
        />
      </div>
    </div>
  );
}
