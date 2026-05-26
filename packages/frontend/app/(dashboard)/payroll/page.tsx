"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Plus, Play, Eye, DollarSign, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { payrollApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store/useAuthStore";

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800", 
  CANCELLED: "bg-red-100 text-red-800",
  APPROVED: "bg-green-100 text-green-800",
  PENDING_APPROVAL: "bg-orange-100 text-orange-800",
};

export default function PayrollPage() {
  const { user } = useAuthStore();
  const [runs, setRuns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<Record<string, any[]>>({});

  // Form state
  const [formData, setFormData] = useState({
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    currency: "USD",
  });

  const canRunPayroll = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'manager';

  const fetchRuns = async () => {
    try {
      setIsLoading(true);
      const data = await payrollApi.getRuns();
      setRuns(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch payroll runs");
      toast.error("Failed to load payroll runs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await payrollApi.createRun(formData);
      setIsModalOpen(false);
      setFormData({ period: new Date().toISOString().slice(0, 7), currency: "USD" });
      toast.success("Payroll run initiated");
      fetchRuns();
    } catch (err: any) {
      toast.error(err.message || "Failed to create payroll run");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this payroll run?")) return;
    try {
      await payrollApi.approveRun(id);
      toast.success("Payroll run approved");
      fetchRuns();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    }
  };

  const toggleExpand = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
    } else {
      setExpandedRun(runId);
      // Fetch payslips if not already loaded
      if (!payslips[runId]) {
        try {
          const data = await payrollApi.getPayslips(runId);
          setPayslips(prev => ({ ...prev, [runId]: data || [] }));
        } catch (err) {
          console.error("Failed to fetch payslips", err);
        }
      }
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  };

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Payroll</h1>
        {canRunPayroll && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Payroll Run
          </Button>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Payroll Run"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pay Period</label>
            <input
              type="month"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.period}
              onChange={e => setFormData({ ...formData, period: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Currency</label>
            <select
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.currency}
              onChange={e => setFormData({ ...formData, currency: e.target.value })}
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="INR">INR - Indian Rupee</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Run Payroll"}
            </Button>
          </div>
        </form>
      </Modal>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs.reduce((sum, r) => sum + (r.totalEmployees || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p>Loading payroll runs...</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No payroll runs found. Click "New Payroll Run" to start.
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => (
                <div key={run.id} className="border rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpand(run.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{run.period}</p>
                        <p className="text-sm text-muted-foreground">
                          {run.totalEmployees || 0} employees • {run.currency || 'USD'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {run.totalAmount ? formatCurrency(run.totalAmount, run.currency) : '-'}
                      </span>
                      <Badge className={statusColors[run.status] || "bg-gray-100"}>
                        {run.status}
                      </Badge>
                      {run.status === 'DRAFT' && canRunPayroll && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubmit({ preventDefault: () => {} } as any);
                          }}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Run
                        </Button>
                      )}
                      {run.status === 'COMPLETED' && canRunPayroll && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(run.id);
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      {expandedRun === run.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded payslips section */}
                  {expandedRun === run.id && (
                    <div className="border-t bg-gray-50 p-4">
                      {(payslips[run.id]?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          <p className="font-medium text-sm mb-3">Payslips</p>
                          {payslips[run.id]?.map((payslip: any) => (
                            <div key={payslip.id} className="flex items-center justify-between bg-white p-3 rounded border">
                              <div>
                                <p className="font-medium text-sm">
                                  {payslip.employeeName || payslip.employee?.firstName + ' ' + payslip.employee?.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{payslip.employeeCode}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(payslip.netPay, run.currency)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Gross: {formatCurrency(payslip.grossPay, run.currency)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading payslips...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canRunPayroll && (
        <Card>
          <CardHeader>
            <CardTitle>Tax Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure income tax brackets and deductions for payroll calculations
            </p>
            <Button variant="outline" onClick={() => toast.info("Tax config coming soon")}>
              Configure Tax Slabs
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}