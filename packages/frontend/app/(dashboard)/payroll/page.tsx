"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, DollarSign, Loader2, ChevronDown, ChevronUp, Download, Pencil, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { payrollApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store/useAuthStore";

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800", 
  CANCELLED: "bg-red-100 text-red-800",
  APPROVED: "bg-green-100 text-green-800",
  PAID: "bg-green-100 text-green-800",
};

export default function PayrollPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [editingTaxSlab, setEditingTaxSlab] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    currency: "USD",
  });

  const [taxFormData, setTaxFormData] = useState({
    min: 0,
    max: 0,
    rate: 0,
    fixed: 0,
  });

  // Queries
  const { data: runs = [], isLoading: isLoadingRuns, error: runsError } = useQuery({
    queryKey: ["payrollRuns"],
    queryFn: () => payrollApi.getRuns(),
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      return data?.some(run => run.status === 'PROCESSING') ? 3000 : false;
    },
  });

  const { data: taxSlabs = [], isLoading: isLoadingSlabs } = useQuery({
    queryKey: ["taxSlabs"],
    queryFn: () => payrollApi.getTaxSlabs(),
  });

  // Fetch payslips for expanded run
  const { data: payslips = [], isLoading: isLoadingPayslips } = useQuery({
    queryKey: ["payslips", expandedRun],
    queryFn: () => expandedRun ? payrollApi.getPayslips(expandedRun) : Promise.resolve([]),
    enabled: !!expandedRun,
  });

  // Mutations
  const createRunMutation = useMutation({
    mutationFn: (data: typeof formData) => payrollApi.createRun(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRuns"] });
      toast.success("Payroll run initiated");
      setIsModalOpen(false);
      setFormData({ period: new Date().toISOString().slice(0, 7), currency: "USD" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create payroll run");
    },
  });

  const approveRunMutation = useMutation({
    mutationFn: (id: string) => payrollApi.approveRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollRuns"] });
      toast.success("Payroll run approved");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve");
    },
  });

  const createTaxSlabMutation = useMutation({
    mutationFn: (data: typeof taxFormData) => payrollApi.createTaxSlab(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxSlabs"] });
      toast.success("Tax slab created");
      setIsTaxModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create tax slab");
    },
  });

  const updateTaxSlabMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof taxFormData }) => payrollApi.updateTaxSlab(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxSlabs"] });
      toast.success("Tax slab updated");
      setIsTaxModalOpen(false);
      setEditingTaxSlab(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update tax slab");
    },
  });

  const deleteTaxSlabMutation = useMutation({
    mutationFn: (id: string) => payrollApi.deleteTaxSlab(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taxSlabs"] });
      toast.success("Tax slab deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete tax slab");
    },
  });

  const userRole = user?.role?.name?.toLowerCase();
  const canRunPayroll = userRole === 'superadmin' || userRole === 'admin' || userRole === 'manager';

  const handleTaxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTaxSlab) {
      updateTaxSlabMutation.mutate({ id: editingTaxSlab.id, data: taxFormData });
    } else {
      createTaxSlabMutation.mutate(taxFormData);
    }
  };

  const handleDeleteTaxSlab = (id: string) => {
    if (!confirm("Are you sure you want to delete this tax slab?")) return;
    deleteTaxSlabMutation.mutate(id);
  };

  const handleRunSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRunMutation.mutate(formData);
  };

  const handleDownloadPayslip = async (payslip: any) => {
    try {
      toast.info(`Generating PDF for ${payslip.employee?.firstName}...`);
      const blob = await payrollApi.downloadPayslip(payslip.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payslip.employee?.employeeCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Download started");
    } catch (err: any) {
      toast.error(err.message || "Failed to download payslip");
    }
  };

  const toggleExpand = (runId: string) => {
    setExpandedRun(expandedRun === runId ? null : runId);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  };

  const calculateTaxBreakdown = (gross: number) => {
    const breakdown: any[] = [];
    let totalTax = 0;

    const sortedSlabs = [...taxSlabs].sort((a, b) => a.minIncome - b.minIncome);
    
    for (const slab of sortedSlabs) {
      if (gross > slab.minIncome) {
        const slabMax = slab.maxIncome || Number.MAX_SAFE_INTEGER;
        const taxableAmountInSlab = Math.min(gross, slabMax) - slab.minIncome;
        
        if (taxableAmountInSlab > 0) {
          const slabTax = (taxableAmountInSlab * (slab.rate / 100));
          totalTax += slabTax;
          breakdown.push({
            label: `${formatCurrency(slab.minIncome, 'USD')} - ${slab.maxIncome ? formatCurrency(slab.maxIncome, 'USD') : 'Above'} (${slab.rate}%)`,
            amount: slabTax,
          });
        }
      }
    }

    const highestSlab = [...sortedSlabs].reverse().find(s => gross >= s.minIncome);
    if (highestSlab && highestSlab.fixedAmount) {
      totalTax += highestSlab.fixedAmount;
      breakdown.push({
        label: `Fixed Amount (from highest slab)`,
        amount: highestSlab.fixedAmount,
      });
    }

    return breakdown;
  };

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Payroll</h1>
        <div className="flex gap-2">
          {canRunPayroll && (
            <Button variant="outline" onClick={() => setIsTaxModalOpen(true)}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Tax Configuration
            </Button>
          )}
          {canRunPayroll && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Payroll Run
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Payroll Run"
      >
        <form onSubmit={handleRunSubmit} className="space-y-4">
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
            <Button type="submit" disabled={createRunMutation.isPending}>
              {createRunMutation.isPending ? "Processing..." : "Run Payroll"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isTaxModalOpen}
        onClose={() => {
          setIsTaxModalOpen(false);
          setEditingTaxSlab(null);
        }}
        title={editingTaxSlab ? "Edit Tax Slab" : "Create Tax Slab"}
      >
        <form onSubmit={handleTaxSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Income</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={taxFormData.min}
                onChange={e => setTaxFormData({ ...taxFormData, min: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Income (0 for Infinity)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={taxFormData.max}
                onChange={e => setTaxFormData({ ...taxFormData, max: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate (%)</label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={taxFormData.rate}
                onChange={e => setTaxFormData({ ...taxFormData, rate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fixed Amount</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={taxFormData.fixed}
                onChange={e => setTaxFormData({ ...taxFormData, fixed: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsTaxModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTaxSlabMutation.isPending || updateTaxSlabMutation.isPending}>
              {createTaxSlabMutation.isPending || updateTaxSlabMutation.isPending ? "Saving..." : "Save Slab"}
            </Button>
          </div>
        </form>
      </Modal>

      {runsError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {(runsError as any).message || "Failed to fetch payroll data"}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoadingRuns ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
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
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRuns ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
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
                        {run.status === 'PROCESSING' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        {run.status}
                      </Badge>
                      {run.status === 'DRAFT' && canRunPayroll && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            approveRunMutation.mutate(run.id);
                          }}
                          disabled={approveRunMutation.isPending}
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
                      {isLoadingPayslips ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32 mb-4" />
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : (payslips?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          <p className="font-medium text-sm mb-3">Payslips</p>
                          {payslips.map((payslip: any) => (
                            <div key={payslip.id} className="bg-white p-3 rounded border">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-sm">
                                    {payslip.employee?.firstName} {payslip.employee?.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{payslip.employee?.employeeCode}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="font-medium text-sm">{formatCurrency(payslip.netSalary, run.currency)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Gross: {formatCurrency(payslip.grossSalary, run.currency)}
                                    </p>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleDownloadPayslip(payslip)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="border-t pt-2 mt-2">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Tax Deduction Breakdown</p>
                                <div className="space-y-1">
                                  {calculateTaxBreakdown(Number(payslip.grossSalary)).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                      <span>{item.label}</span>
                                      <span className="font-medium text-red-600">-{formatCurrency(item.amount, run.currency)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between text-xs font-bold border-t pt-1 mt-1">
                                    <span>Total Deduction</span>
                                    <span>{formatCurrency(payslip.taxDeduction, run.currency)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No payslips found for this run.</p>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tax Configuration</CardTitle>
            <Button variant="outline" size="sm" onClick={() => {
              setEditingTaxSlab(null);
              setTaxFormData({ min: 0, max: 0, rate: 0, fixed: 0 });
              setIsTaxModalOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Add Slab
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">Min Income</th>
                    <th className="text-left py-2 font-semibold">Max Income</th>
                    <th className="text-left py-2 font-semibold">Rate (%)</th>
                    <th className="text-left py-2 font-semibold">Fixed Amt</th>
                    <th className="text-right py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoadingSlabs ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="py-2"><Skeleton className="h-8 w-full" /></td>
                      </tr>
                    ))
                  ) : taxSlabs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                        No tax slabs configured. Calculations will use 0% tax.
                      </td>
                    </tr>
                  ) : (
                    [...taxSlabs].sort((a,b) => a.minIncome - b.minIncome).map((slab) => (
                      <tr key={slab.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5">{formatCurrency(slab.minIncome, 'USD')}</td>
                        <td className="py-2.5">{slab.maxIncome ? formatCurrency(slab.maxIncome, 'USD') : 'Above'}</td>
                        <td className="py-2.5 font-medium text-blue-600">{slab.rate}%</td>
                        <td className="py-2.5">{formatCurrency(slab.fixedAmount || 0, 'USD')}</td>
                        <td className="py-2.5 text-right flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              setEditingTaxSlab(slab);
                              setTaxFormData({
                                min: slab.minIncome,
                                max: slab.maxIncome || 0,
                                rate: slab.rate,
                                fixed: slab.fixedAmount || 0,
                              });
                              setIsTaxModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteTaxSlab(slab.id)}
                            disabled={deleteTaxSlabMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
