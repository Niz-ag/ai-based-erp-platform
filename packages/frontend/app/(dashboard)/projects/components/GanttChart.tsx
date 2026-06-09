"use client";

import { useState, useMemo } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { projectsApi } from "@/lib/api";
import { toast } from "sonner";

interface GanttChartProps {
  tasks?: Record<string, any>[];
  projects?: Record<string, any>[];
}

export function GanttChart({ tasks = [], projects = [] }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);

  const handleTaskChange = async (task: Task) => {
    try {
      if (task.type === "task") {
        await projectsApi.updateTask(task.id, {
          startDate: task.start.toISOString(),
          dueDate: task.end.toISOString(),
          status: task.progress === 100 ? "COMPLETED" : undefined,
        });
        toast.success(`Updated task: ${task.name}`);
      } else if (task.type === "project") {
        await projectsApi.update(task.id, {
          startDate: task.start.toISOString(),
          endDate: task.end.toISOString(),
        });
        toast.success(`Updated project: ${task.name}`);
      }
    } catch (error) {
      console.error("Failed to update task/project:", error);
      toast.error("Failed to persist changes");
    }
  };

  const ganttTasks: Task[] = useMemo(() => {
    const now = new Date();
    // Default to a 30-day range if dates are missing
    const defaultStart = now;
    const defaultEnd = new Date(now.getTime() + 86400000 * 30);

    // If we have projects and no specific tasks, show projects as bars
    if (projects.length > 0 && tasks.length === 0) {
      return projects.map((p) => {
        let start = p.startDate ? new Date(p.startDate as string) : defaultStart;
        let end = p.endDate ? new Date(p.endDate as string) : defaultEnd;
        
        // Validation: End must be after Start
        if (isNaN(start.getTime())) start = defaultStart;
        if (isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 86400000 * 7);

        return {
          start,
          end,
          name: p.name as string,
          id: p.id as string,
          type: "project" as const,
          progress: Number(p.progress || 0),
          styles: { progressColor: "#3b82f6", progressSelectedColor: "#2563eb" },
        };
      });
    }

    // If we have tasks, show them
    if (tasks.length > 0) {
      const mappedTasks = tasks.map((t) => {
        let end = t.dueDate ? new Date(t.dueDate as string) : null;
        let start = t.startDate ? new Date(t.startDate as string) : null;

        if (!start && end && !isNaN(end.getTime())) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // Default to today if deadline is in future, else dueDate - 1
          if (end.getTime() > today.getTime()) {
            start = today;
          } else {
            start = new Date(end.getTime() - 86400000);
          }
        } else if (!start && !end) {
          start = new Date((t.createdAt as string) || now);
          end = new Date(start.getTime() + 86400000);
        } else if (start && !end) {
          end = new Date(start.getTime() + 86400000);
        }
        
        // Final validation: Ensure Gantt doesn't crash, but respect valid deadlines
        if (!start || isNaN(start.getTime())) start = now;
        if (!end || isNaN(end.getTime())) {
          end = new Date(start.getTime() + 86400000);
        } else if (end <= start) {
          // Move start back instead of pushing end forward to respect valid deadlines
          start = new Date(end.getTime() - 86400000);
        }

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

      return mappedTasks.sort((a, b) => a.start.getTime() - b.start.getTime());
    }

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
          onDateChange={handleTaskChange}
          onProgressChange={handleTaskChange}
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
