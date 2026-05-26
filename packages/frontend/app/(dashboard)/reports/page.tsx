"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Plus, FileText, Calendar, Play, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportsApi } from "@/lib/api";

const typeColors: Record<string, string> = {
  Financial: "bg-green-100 text-green-800",
  HR: "bg-blue-100 text-blue-800",
  Operations: "bg-orange-100 text-orange-800",
  Projects: "bg-purple-100 text-purple-800",
};

const reportTypes = [
  { id: "profit_loss", name: "Profit & Loss", category: "Financial" },
  { id: "balance_sheet", name: "Balance Sheet", category: "Financial" },
  { id: "cash_flow", name: "Cash Flow", category: "Financial" },
  { id: "headcount", name: "Employee Headcount", category: "HR" },
  { id: "payroll_summary", name: "Payroll Summary", category: "HR" },
  { id: "inventory", name: "Inventory Summary", category: "Operations" },
  { id: "project_status", name: "Project Status", category: "Projects" },
];

export default function ReportsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    schedule: "monthly",
  });

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsApi.getAll(),
  });

  const handleGenerate = async (reportId: string) => {
    try {
      await reportsApi.generate(reportData.type);
      toast.success("Report generation started");
      refetch();
    } catch (err) {
      toast.error("Failed to generate report");
    }
  };

  const reportData = reports?.data || [];
  
  const dailyCount = reportData.filter((r: any) => r.schedule === 'daily').length;
  const weeklyCount = reportData.filter((r: any) => r.schedule === 'weekly').length;
  const monthlyCount = reportData.filter((r: any) => r.schedule === 'monthly').length;

  return (
    <div className="p-6 space-y-6">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Scheduled Report">
        <form className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Type</label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="">Select report...</option>
              {reportTypes.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule</label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={formData.schedule}
              onChange={e => setFormData({ ...formData, schedule: e.target.value })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" onClick={() => { setIsModalOpen(false); toast.info("Report scheduling coming soon"); }}>
              Create Schedule
            </Button>
          </div>
        </form>
      </Modal>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Scheduled Reports</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weekly</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No scheduled reports. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {reportData.map((report: any) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={typeColors[report.type] || "bg-gray-100"}>
                          {report.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {report.schedule}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="text-center">
                      <p className="font-medium text-foreground">Next Run</p>
                      <p>{report.nextRun ? new Date(report.nextRun).toLocaleDateString() : '-'}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground">Last Run</p>
                      <p>{report.lastRun ? new Date(report.lastRun).toLocaleDateString() : '-'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleGenerate(report.id)}>
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}