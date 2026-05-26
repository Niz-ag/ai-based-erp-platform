"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, tasksApi } from "@/lib/api";
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  MoreVertical,
  DollarSign,
  LayoutList,
  GanttChartIcon,
  Flag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import { GanttChart } from "./GanttChart";

interface ProjectDetailsProps {
  projectId: string;
  onBack: () => void;
}

type ProjectTab = "tasks" | "gantt" | "milestones";

export function ProjectDetails({ projectId, onBack }: ProjectDetailsProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProjectTab>("tasks");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
  });

  const [milestoneForm, setMilestoneForm] = useState({
    name: "",
    description: "",
    dueDate: "",
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getById(projectId),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => projectsApi.createTask(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setIsTaskModalOpen(false);
      setTaskForm({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
      toast.success("Task created successfully");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const createMilestoneMutation = useMutation({
    mutationFn: (data: any) => projectsApi.createMilestone({ ...data, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setIsMilestoneModalOpen(false);
      setMilestoneForm({ name: "", description: "", dueDate: "" });
      toast.success("Milestone created successfully");
    },
    onError: () => toast.error("Failed to create milestone"),
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => 
      tasksApi.update(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task status updated");
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data: any) => projectsApi.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Project updated successfully");
    },
    onError: () => toast.error("Failed to update project"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) return <div>Project not found</div>;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    createTaskMutation.mutate(taskForm);
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    createMilestoneMutation.mutate(milestoneForm);
  };

  const statusColors = {
    PLANNING: "bg-gray-100 text-gray-700",
    ACTIVE: "bg-blue-100 text-blue-700",
    ON_HOLD: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
  };

  const priorityColors = {
    LOW: "text-gray-500",
    MEDIUM: "text-blue-500",
    HIGH: "text-orange-500",
    URGENT: "text-red-500",
  };

  const tabs = [
    { id: "tasks" as ProjectTab, label: "Tasks", icon: LayoutList },
    { id: "gantt" as ProjectTab, label: "Gantt Chart", icon: GanttChartIcon },
    { id: "milestones" as ProjectTab, label: "Milestones", icon: Flag },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{project.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <select 
                className={`px-2 py-0.5 rounded-full text-xs font-medium border-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${statusColors[project.status as keyof typeof statusColors]}`}
                value={project.status}
                onChange={(e) => updateProjectMutation.mutate({ status: e.target.value })}
              >
                <option value="PLANNING">PLANNING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_HOLD">ON_HOLD</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'No start date'} 
                {project.endDate && ` - ${new Date(project.endDate).toLocaleDateString()}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => setIsMilestoneModalOpen(true)}>
            <Flag className="h-4 w-4 mr-1" /> Add Milestone
          </Button>
          <Button size="sm" onClick={() => setIsTaskModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
        </div>
      </div>

      {/* Internal Tabs */}
      <div className="flex gap-4 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Main Content Area */}
        <div className="md:col-span-3">
          {activeTab === "tasks" && (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="divide-y">
                {project.tasks && project.tasks.length > 0 ? (
                  project.tasks.map((task: any) => (
                    <div key={task.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 group">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => updateTaskStatusMutation.mutate({ 
                            taskId: task.id, 
                            status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' 
                          })}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {task.status === 'COMPLETED' ? 
                            <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                            <Circle className="h-5 w-5" />
                          }
                        </button>
                        <div>
                          <p className={`font-medium ${task.status === 'COMPLETED' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className={priorityColors[task.priority as keyof typeof priorityColors]}>
                              {task.priority}
                            </span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.assignee && (
                              <span>@{task.assignee.firstName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No tasks yet. Create one to get started.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "gantt" && (
            <div className="bg-white border rounded-lg shadow-sm p-4">
              <GanttChart tasks={project.tasks} />
            </div>
          )}

          {activeTab === "milestones" && (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
               <div className="divide-y">
                {project.milestones && project.milestones.length > 0 ? (
                  project.milestones.map((milestone: any) => (
                    <div key={milestone.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Flag className={`h-5 w-5 ${milestone.status === 'COMPLETED' ? 'text-green-500' : 'text-yellow-500'}`} />
                        <div>
                          <p className="font-medium">{milestone.name}</p>
                          {milestone.dueDate && (
                            <p className="text-xs text-muted-foreground">Due: {new Date(milestone.dueDate).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${milestone.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {milestone.status || 'PENDING'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-muted-foreground">
                    <Flag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No milestones yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white border rounded-lg shadow-sm p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Budget Details
            </h3>
            {project.budget ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Planned</span>
                    <span className="font-medium">${Number(project.budget.plannedAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Actual spent</span>
                    <span className="font-medium">${Number(project.budget.actualAmount).toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      (Number(project.budget.actualAmount) / Number(project.budget.plannedAmount)) > 0.9 ? 'bg-red-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, (Number(project.budget.actualAmount) / Number(project.budget.plannedAmount)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {project.budget.notes || "No notes on budget."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No budget defined.</p>
            )}
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-6">
            <h3 className="font-semibold mb-4">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {project.description || 'No description provided.'}
            </p>
          </div>
        </div>
      </div>

      {/* Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Add New Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Task Title</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={taskForm.title}
              onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="Design UI mockups"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={taskForm.description}
              onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <select
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={taskForm.priority}
                onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={taskForm.dueDate}
                onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Milestone Modal */}
      <Modal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        title="Add New Milestone"
      >
        <form onSubmit={handleCreateMilestone} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Milestone Name</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={milestoneForm.name}
              onChange={e => setMilestoneForm({ ...milestoneForm, name: e.target.value })}
              placeholder="Beta Launch"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={milestoneForm.description}
              onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date</label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={milestoneForm.dueDate}
              onChange={e => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsMilestoneModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMilestoneMutation.isPending}>
              {createMilestoneMutation.isPending ? "Creating..." : "Create Milestone"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
