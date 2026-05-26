"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { employeesApi, departmentsApi, leaveRequestsApi } from "@/lib/api";
import { Users, Building2, Calendar, Plus, X, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const employeeSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  position: z.string().optional(),
  departmentId: z.string().optional(),
  hireDate: z.string().optional(),
});

const deptSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
});

type TabType = "employees" | "departments" | "leave";

type EmployeeFormData = z.infer<typeof employeeSchema>;
type DeptFormData = z.infer<typeof deptSchema>;

export default function HRPage() {
  const [activeTab, setActiveTab] = useState<TabType>("employees");
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

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
      hireDate: new Date().toISOString().split('T')[0],
    },
  });

  const deptForm = useForm<DeptFormData>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", description: "" },
  });

  const { data: employeesData, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.getAll(),
  });

  const { data: departmentsData, isLoading: departmentsLoading, refetch: refetchDepts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.getAll(),
  });

  const { data: leaveRequestsData, isLoading: leaveLoading, refetch: refetchLeaves } = useQuery({
    queryKey: ["leave-requests"],
    queryFn: () => leaveRequestsApi.getAll(),
  });

  const handleApproveLeave = async (id: string) => {
    try {
      await leaveRequestsApi.approve(id);
      refetchLeaves();
      toast.success("Leave request approved");
    } catch (err: any) {
      toast.error("Failed to approve", { description: err.message });
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      await leaveRequestsApi.reject(id);
      refetchLeaves();
      toast.success("Leave request rejected");
    } catch (err: any) {
      toast.error("Failed to reject", { description: err.message });
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

  const handleDeleteEmployee = async (id: string) => {
    try {
      await employeesApi.delete(id);
      refetchEmployees();
      toast.success("Employee deleted");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    }
  };

  const tabs = [
    { id: "employees" as TabType, label: "Employees", icon: Users },
    { id: "departments" as TabType, label: "Departments", icon: Building2 },
    { id: "leave" as TabType, label: "Leave Requests", icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Human Resources</h1>
        <p className="text-muted-foreground">
          Manage employees, departments, and leave requests
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
        title="Employee Details"
      >
        {selectedEmployee && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedEmployee.firstName} {selectedEmployee.lastName}</h2>
                <p className="text-muted-foreground">{selectedEmployee.position}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Employee Code</p>
                <p className="text-sm font-mono mt-1">{selectedEmployee.employeeCode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Department</p>
                <p className="text-sm mt-1">{selectedEmployee.department?.name || "Not Assigned"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Email Address</p>
                <p className="text-sm mt-1">{selectedEmployee.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Phone</p>
                <p className="text-sm mt-1">{selectedEmployee.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Hire Date</p>
                <p className="text-sm mt-1">
                  {selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${selectedEmployee.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {selectedEmployee.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t">
              <Button onClick={() => setSelectedEmployee(null)}>Close</Button>
            </div>
          </div>
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
                                onClick={() => handleApproveLeave(request.id)}
                              >
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
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