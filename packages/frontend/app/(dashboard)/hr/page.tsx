"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { employeesApi, departmentsApi, leaveRequestsApi, attendanceApi } from "@/lib/api";
import { Users, Building2, Calendar, Plus, X, Loader2, Clock, FileDown, CheckCircle2, XCircle, History } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, PermissionGuard } from "@/components";
import { useSearchParams } from "next/navigation";

const employeeSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  position: z.string().optional(),
  departmentId: z.string().optional(),
  hireDate: z.string().optional(),
  salary: z.any().optional(),
  hourlyRate: z.any().optional(),
  createSystemUser: z.boolean(),
});

const deptSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
});

type TabType = "employees" | "departments" | "leave" | "attendance";

type EmployeeFormData = z.infer<typeof employeeSchema>;
type DeptFormData = z.infer<typeof deptSchema>;

export default function HRPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("employees");
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leaveForm = useForm<any>({
    defaultValues: {
      employeeId: "",
      leaveType: "ANNUAL",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: "",
    },
  });

  const onLeaveSubmit = async (data: any) => {
    try {
      await leaveRequestsApi.create(data);
      setIsLeaveModalOpen(false);
      leaveForm.reset();
      refetchLeaves();
      toast.success("Leave request submitted");
    } catch (err: any) {
      toast.error("Failed to submit request", { description: err.message });
    }
  };

  const employeeForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employeeCode: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      departmentId: "",
      salary: 0,
      hourlyRate: 0,
      hireDate: new Date().toISOString().split('T')[0],
      createSystemUser: false,
    },
  });

  const editEmployeeForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  // Reset edit form when selectedEmployee changes
  React.useEffect(() => {
    if (selectedEmployee) {
      editEmployeeForm.reset({
        employeeCode: selectedEmployee.employeeCode,
        firstName: selectedEmployee.firstName,
        lastName: selectedEmployee.lastName,
        email: selectedEmployee.email,
        phone: selectedEmployee.phone || "",
        position: selectedEmployee.position || "",
        departmentId: selectedEmployee.departmentId || "",
        salary: selectedEmployee.salary || 0,
        hourlyRate: selectedEmployee.hourlyRate || 0,
        hireDate: selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        createSystemUser: false,
      });
    }
  }, [selectedEmployee, editEmployeeForm]);

  const deptForm = useForm<DeptFormData>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", description: "" },
  });

  const { data: employeesData, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.getAll(),
  });

  // Handle deep-link
  React.useEffect(() => {
    const id = searchParams.get("id");
    if (id && employeesData && employeesData.length > 0) {
      const employee = employeesData.find((e: any) => e.id === id);
      if (employee) {
        setTimeout(() => {
          setSelectedEmployee(employee);
          setActiveTab("employees");
        }, 0);
      }
    }
  }, [searchParams, employeesData]);

  const { data: departmentsData, isLoading: departmentsLoading, refetch: refetchDepts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.getAll(),
  });

  const { data: leaveRequestsData, isLoading: leaveLoading, refetch: refetchLeaves } = useQuery({
    queryKey: ["leave-requests"],
    queryFn: () => leaveRequestsApi.getAll(),
  });

  const { data: attendanceData, isLoading: attendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ["attendance"],
    queryFn: () => attendanceApi.getAll(),
    enabled: activeTab === "attendance",
  });

  const { data: attendanceStatus, refetch: refetchAttendanceStatus } = useQuery({
    queryKey: ["attendance-status"],
    queryFn: () => attendanceApi.getStatus(),
  });

  const { data: leaveBalances, isLoading: balancesLoading } = useQuery({
    queryKey: ["leave-balances"],
    queryFn: () => leaveRequestsApi.getBalances(),
  });

  const clockInMutation = useMutation({
    mutationFn: () => attendanceApi.clockIn(),
    onSuccess: () => {
      toast.success("Clocked in successfully");
      refetchAttendanceStatus();
      if (activeTab === "attendance") refetchAttendance();
    },
    onError: (err: any) => toast.error("Failed to clock in", { description: err.message }),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => attendanceApi.clockOut(),
    onSuccess: () => {
      toast.success("Clocked out successfully");
      refetchAttendanceStatus();
      if (activeTab === "attendance") refetchAttendance();
    },
    onError: (err: any) => toast.error("Failed to clock out", { description: err.message }),
  });

  const exportAttendanceMutation = useMutation({
    mutationFn: (employeeId: string) => attendanceApi.exportReport(employeeId, new Date().toISOString().slice(0, 7)),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `attendance-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("Attendance report downloaded");
    },
    onError: () => toast.error("Failed to export report"),
  });

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Are you sure you want to remove this employee? This will deactivate their account.")) return;
    setIsSubmitting(true);
    try {
      await employeesApi.delete(id);
      refetchEmployees();
      toast.success("Employee deactivated successfully");
    } catch (err: any) {
      toast.error("Failed to remove employee", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };
const handleApproveLeave = async (id: string) => {
  setIsSubmitting(true);
  try {
    await leaveRequestsApi.approve(id);
    refetchLeaves();
    toast.success("Leave request approved");
  } catch (err: any) {
    toast.error("Failed to approve", { description: err.message });
  } finally {
    setIsSubmitting(false);
  }
};

const handleRejectLeave = async (id: string) => {
  setIsSubmitting(true);
  try {
    await leaveRequestsApi.reject(id);
    refetchLeaves();
    toast.success("Leave request rejected");
  } catch (err: any) {
    toast.error("Failed to reject", { description: err.message });
  } finally {
    setIsSubmitting(false);
  }
};

  const onEmployeeSubmit = async (data: EmployeeFormData) => {
    try {
      await employeesApi.create(data);
      setIsEmployeeModalOpen(false);
      employeeForm.reset();
      refetchEmployees();
      toast.success("Employee created", { description: `${data.firstName} ${data.lastName} added successfully` });
    } catch (err: any) {
      toast.error("Failed to create employee", { description: err.message });
    }
  };

  const onEmployeeUpdate = async (data: EmployeeFormData) => {
    try {
      await employeesApi.update(selectedEmployee.id, data);
      setSelectedEmployee(null);
      refetchEmployees();
      toast.success("Employee updated", { description: `${data.firstName} ${data.lastName} updated successfully` });
    } catch (err: any) {
      toast.error("Failed to update employee", { description: err.message });
    }
  };

  const onDeptSubmit = async (data: DeptFormData) => {
    try {
      await departmentsApi.create(data);
      setIsDeptModalOpen(false);
      deptForm.reset();
      refetchDepts();
      toast.success("Department created", { description: `${data.name} added successfully` });
    } catch (err: any) {
      toast.error("Failed to create department", { description: err.message });
    }
  };

  const tabs = [
    { id: "employees" as TabType, label: "Employees", icon: Users },
    { id: "departments" as TabType, label: "Departments", icon: Building2 },
    { id: "leave" as TabType, label: "Leave Requests", icon: Calendar },
    { id: "attendance" as TabType, label: "Attendance", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Human Resources</h1>
          <p className="text-muted-foreground">
            Manage employees, departments, and leave requests
          </p>
        </div>
        <div className="flex gap-2">
          {attendanceStatus?.isClockedIn ? (
            <Button 
              variant="outline" 
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
              onClick={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
            >
              <Clock className="mr-2 h-4 w-4" /> Clock Out
            </Button>
          ) : (
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => clockInMutation.mutate()}
              disabled={clockInMutation.isPending}
            >
              <Clock className="mr-2 h-4 w-4" /> Clock In
            </Button>
          )}
          {activeTab === "employees" && (
            <PermissionGuard permissions={["hr_write"]}>
              <Button onClick={() => setIsEmployeeModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Employee
              </Button>
            </PermissionGuard>
          )}
          {activeTab === "departments" && (
            <PermissionGuard permissions={["hr_write"]}>
              <Button onClick={() => setIsDeptModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Department
              </Button>
            </PermissionGuard>
          )}
          {activeTab === "leave" && (
            <Button onClick={() => setIsLeaveModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Request Leave
            </Button>
          )}
        </div>
      </div>

      {/* Leave Balances Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {balancesLoading ? (
          <div className="col-span-4 h-24 flex items-center justify-center border rounded-lg bg-gray-50/50">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leaveBalances && leaveBalances.length > 0 ? (
          leaveBalances.map((balance: any) => (
            <div key={balance.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {balance.leaveType} ({balance.year})
                </p>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <div className="text-2xl font-bold">
                  {Number(balance.totalDays) - Number(balance.usedDays)} days left
                </div>
                <p className="text-xs text-muted-foreground">
                  Used: {Number(balance.usedDays)} / Total: {Number(balance.totalDays)}
                </p>
                <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                    style={{ width: `${(Number(balance.usedDays) / Number(balance.totalDays)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-4 p-4 border rounded-lg bg-gray-50/50 text-center text-sm text-muted-foreground">
            No leave balances found for current user.
          </div>
        )}
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
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        title="Add New Employee"
      >
        <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee Code</label>
              <input
                {...employeeForm.register("employeeCode")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="EMP001"
              />
              {employeeForm.formState.errors.employeeCode && (
                <p className="text-xs text-red-500">{employeeForm.formState.errors.employeeCode.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Position</label>
              <input
                {...employeeForm.register("position")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Software Engineer"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <input
                {...employeeForm.register("firstName")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {employeeForm.formState.errors.firstName && (
                <p className="text-xs text-red-500">{employeeForm.formState.errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <input
                {...employeeForm.register("lastName")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {employeeForm.formState.errors.lastName && (
                <p className="text-xs text-red-500">{employeeForm.formState.errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              {...employeeForm.register("email")}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {employeeForm.formState.errors.email && (
              <p className="text-xs text-red-500">{employeeForm.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Department</label>
            <select
              {...employeeForm.register("departmentId")}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Department</option>
              {departmentsData?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Annual Salary</label>
              <input
                type="number"
                {...employeeForm.register("salary")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="50000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hourly Rate</label>
              <input
                type="number"
                {...employeeForm.register("hourlyRate")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="25"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="createSystemUser"
              {...employeeForm.register("createSystemUser")}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="createSystemUser" className="text-sm font-medium cursor-pointer">
              Create system user account for login
            </label>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsEmployeeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={employeeForm.formState.isSubmitting}>
              {employeeForm.formState.isSubmitting ? "Creating..." : "Create Employee"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Add New Department"
      >
        <form onSubmit={deptForm.handleSubmit(onDeptSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Department Name</label>
            <input
              {...deptForm.register("name")}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Engineering"
            />
            {deptForm.formState.errors.name && (
              <p className="text-xs text-red-500">{deptForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              {...deptForm.register("description")}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsDeptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={deptForm.formState.isSubmitting}>
              {deptForm.formState.isSubmitting ? "Creating..." : "Create Department"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title="Edit Employee"
      >
        {selectedEmployee && (
          <form onSubmit={editEmployeeForm.handleSubmit(onEmployeeUpdate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee Code</label>
                <input
                  {...editEmployeeForm.register("employeeCode")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="EMP001"
                />
                {editEmployeeForm.formState.errors.employeeCode && (
                  <p className="text-xs text-red-500">{editEmployeeForm.formState.errors.employeeCode.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Position</label>
                <input
                  {...editEmployeeForm.register("position")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Software Engineer"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <input
                  {...editEmployeeForm.register("firstName")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {editEmployeeForm.formState.errors.firstName && (
                  <p className="text-xs text-red-500">{editEmployeeForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <input
                  {...editEmployeeForm.register("lastName")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {editEmployeeForm.formState.errors.lastName && (
                  <p className="text-xs text-red-500">{editEmployeeForm.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                {...editEmployeeForm.register("email")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {editEmployeeForm.formState.errors.email && (
                <p className="text-xs text-red-500">{editEmployeeForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <select
                {...editEmployeeForm.register("departmentId")}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Department</option>
                {departmentsData?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Annual Salary</label>
                <input
                  type="number"
                  {...editEmployeeForm.register("salary")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hourly Rate</label>
                <input
                  type="number"
                  {...editEmployeeForm.register("hourlyRate")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" type="button" onClick={() => setSelectedEmployee(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editEmployeeForm.formState.isSubmitting}>
                {editEmployeeForm.formState.isSubmitting ? "Updating..." : "Update Employee"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Employees Tab Content */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsEmployeeModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>

          <div className="rounded-lg border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Position</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Department</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employeesLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        <div className="flex justify-center items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading employees...
                        </div>
                      </td>
                    </tr>
                  ) : employeesData && employeesData.length > 0 ? (
                    employeesData.map((employee: any) => (
                      <tr 
                        key={employee.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedEmployee(employee)}
                      >
                        <td className="px-4 py-3 text-sm font-mono">{employee.employeeCode}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {employee.firstName} {employee.lastName}
                        </td>
                        <td className="px-4 py-3 text-sm">{employee.email}</td>
                        <td className="px-4 py-3 text-sm">{employee.position || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {employee.department?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isSubmitting}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmployee(employee.id);
                            }}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No employees found. Add your first employee to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Employee</th>
                    <th className="px-4 py-3 text-center font-semibold">Check In</th>
                    <th className="px-4 py-3 text-center font-semibold">Check Out</th>
                    <th className="px-4 py-3 text-center font-semibold">Hours</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendanceLoading ? (
                    <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></td></tr>
                  ) : attendanceData && attendanceData.length > 0 ? (
                    attendanceData.map((att: any) => (
                      <tr key={att.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {att.employee?.firstName} {att.employee?.lastName}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {new Date(att.checkIn).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {att.checkOut ? new Date(att.checkOut).toLocaleString() : 'Active'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          {att.workHours ? `${Number(att.workHours).toFixed(2)}h` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => exportAttendanceMutation.mutate(att.employeeId)}
                            disabled={exportAttendanceMutation.isPending}
                          >
                            <FileDown className="h-4 w-4 mr-1" /> PDF
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No attendance records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Departments Tab Content */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsDeptModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departmentsLoading ? (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading departments...
              </div>
            ) : departmentsData && departmentsData.length > 0 ? (
              departmentsData.map((dept: any) => (
                <div key={dept.id} className="rounded-lg border bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{dept.name}</h3>
                      <p className="text-sm text-muted-foreground">{dept.description || 'No description'}</p>
                    </div>
                    <Building2 className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs">
                    <span className="text-muted-foreground uppercase font-bold tracking-wider">
                      DEPARTMENT
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                No departments found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Requests Tab Content */}
      {activeTab === "leave" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsLeaveModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Request Leave
            </Button>
          </div>

          <Modal
            isOpen={isLeaveModalOpen}
            onClose={() => setIsLeaveModalOpen(false)}
            title="New Leave Request"
          >
            <form onSubmit={leaveForm.handleSubmit(onLeaveSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <select
                  {...leaveForm.register("employeeId")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Employee</option>
                  {employeesData?.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Leave Type</label>
                <select
                  {...leaveForm.register("leaveType")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ANNUAL">Annual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="UNPAID">Unpaid Leave</option>
                  <option value="MATERNITY">Maternity Leave</option>
                  <option value="PATERNITY">Paternity Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    {...leaveForm.register("startDate")}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    {...leaveForm.register("endDate")}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <textarea
                  {...leaveForm.register("reason")}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional reason for leave..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" type="button" onClick={() => setIsLeaveModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={leaveForm.formState.isSubmitting}>
                  {leaveForm.formState.isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </Modal>

          <div className="rounded-lg border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Start Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leaveLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Loading leave requests...
                      </td>
                    </tr>
                  ) : leaveRequestsData && leaveRequestsData.length > 0 ? (
                    leaveRequestsData.map((request: any) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">{request.leaveType || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {request.startDate ? new Date(request.startDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            request.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {request.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {request.status === 'PENDING' && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8"
                                disabled={isSubmitting}
                                onClick={() => handleApproveLeave(request.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                                disabled={isSubmitting}
                                onClick={() => handleRejectLeave(request.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No leave requests found.
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