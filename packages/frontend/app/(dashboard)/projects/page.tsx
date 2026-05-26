"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api";
import { FolderKanban, Flag, Calendar, Plus, ChevronRight, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { GanttChart } from "./components/GanttChart";
import { ProjectDetails } from "./components/ProjectDetails";

type TabType = "projects" | "gantt" | "milestones";

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [projectForm, setProjectData] = useState({
    name: "",
    description: "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    plannedAmount: 0,
  });

  const [milestoneForm, setMilestoneData] = useState({
    name: "",
    description: "",
    dueDate: new Date().toISOString().split('T')[0],
    projectId: "",
  });

  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });

  const { data: milestonesData, isLoading: milestonesLoading, refetch: refetchMilestones } = useQuery({
    queryKey: ["milestones"],
    queryFn: () => projectsApi.getMilestones(),
  });

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await projectsApi.create(projectForm);
      setIsProjectModalOpen(false);
      setProjectData({
        name: "",
        description: "",
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        plannedAmount: 0,
      });
      refetchProjects();
    } catch (err: any) {
      toast.error("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await projectsApi.createMilestone(milestoneForm);
      setIsMilestoneModalOpen(false);
      setMilestoneData({
        name: "",
        description: "",
        dueDate: new Date().toISOString().split('T')[0],
        projectId: "",
      });
      refetchMilestones();
    } catch (err: any) {
      toast.error("Failed to create milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await projectsApi.delete(id);
      refetchProjects();
    } catch (err: any) {
      toast.error("Failed to delete project");
    }
  };

  const tabs = [
    { id: "projects" as TabType, label: "Projects List", icon: FolderKanban },
    { id: "gantt" as TabType, label: "Gantt Chart", icon: Calendar },
    { id: "milestones" as TabType, label: "Milestones", icon: Flag },
  ];

  // Generate Gantt data for placeholder
  const ganttData = React.useMemo(() => {
    return projectsData?.map((project: any) => {
      const startDate = project.startDate || new Date().toISOString();
      const endDate = project.endDate || new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return {
        id: project.id,
        name: project.name,
        startDate,
        endDate,
        progress: project.progress || 0,
        status: project.status || 'NOT_STARTED',
      };
    }) || [];
  }, [projectsData]);

  // If a project is selected, show details view instead of the list/tabs
  if (selectedProjectId) {
    return (
      <ProjectDetails 
        projectId={selectedProjectId} 
        onBack={() => setSelectedProjectId(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          Manage projects, view Gantt charts, and track milestones
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
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

      {/* Modals */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title="Add New Project"
      >
        <form onSubmit={handleAddProject} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={projectForm.name}
              onChange={e => setProjectData({ ...projectForm, name: e.target.value })}
              placeholder="E-commerce Platform"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={projectForm.description}
              onChange={e => setProjectData({ ...projectForm, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={projectForm.startDate}
                onChange={e => setProjectData({ ...projectForm, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={projectForm.endDate}
                onChange={e => setProjectData({ ...projectForm, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Budget Amount</label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={projectForm.plannedAmount}
              onChange={e => setProjectData({ ...projectForm, plannedAmount: Number(e.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsProjectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        title="Add New Milestone"
      >
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Milestone Name</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={milestoneForm.name}
              onChange={e => setMilestoneData({ ...milestoneForm, name: e.target.value })}
              placeholder="Beta Launch"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Project</label>
            <select
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={milestoneForm.projectId}
              onChange={e => setMilestoneData({ ...milestoneForm, projectId: e.target.value })}
            >
              <option value="">Select Project</option>
              {projectsData?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date</label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={milestoneForm.dueDate}
              onChange={e => setMilestoneData({ ...milestoneForm, dueDate: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsMilestoneModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Milestone"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Projects List Tab Content */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsProjectModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectsLoading ? (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading projects...
              </div>
            ) : projectsData && projectsData.length > 0 ? (
              projectsData.map((project: any) => (
                <div 
                  key={project.id} 
                  className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteProject(e, project.id)}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{project.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {project.description || 'No description'}
                      </p>
                    </div>
                    <FolderKanban className="h-8 w-8 text-gray-400" />
                  </div>
                  
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        project.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        project.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                        project.status === 'ON_HOLD' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {project.status || 'PLANNING'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-medium">${Number(project.budget?.plannedAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                No projects found. Create your first project to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gantt Chart Tab */}
      {activeTab === "gantt" && (
        <div className="space-y-4">
          <GanttChart projects={projectsData} />
        </div>
      )}

      {/* Milestones Tab Content */}
      {activeTab === "milestones" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsMilestoneModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Milestone
            </Button>
          </div>

          <div className="rounded-lg border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Project</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Due Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {milestonesLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : milestonesData && milestonesData.length > 0 ? (
                    milestonesData.map((milestone: any) => (
                      <tr key={milestone.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Flag className="h-4 w-4 text-yellow-500" />
                            {milestone.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {milestone.project?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            milestone.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {milestone.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No milestones found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
