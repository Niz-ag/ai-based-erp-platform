"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MoreVertical, Loader2 } from "lucide-react";
import { tenantsApi } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";

export default function TenantsPage() {
  const { user } = useAuthStore();
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", domain: "" });

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Tenant name is required");
      return;
    }
    try {
      setIsSubmitting(true);
      await tenantsApi.create({ name: formData.name, domain: formData.domain });
      toast.success("Tenant created successfully");
      setIsModalOpen(false);
      setFormData({ name: "", domain: "" });
      // Refresh list
      const data = await tenantsApi.getAll();
      setTenants(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to create tenant");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Only superadmin can add tenants
  const canAddTenant = user?.role === 'superadmin';

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setIsLoading(true);
        const data = await tenantsApi.getAll();
        setTenants(data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch tenants");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">
            Manage your organization's tenants
          </p>
        </div>
        {canAddTenant && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tenant
          </Button>
        )}
      </div>

      {/* Add Tenant Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Tenant">
        <form onSubmit={handleCreateTenant} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tenant Name *</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Acme Corporation"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Domain (optional)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.domain}
              onChange={e => setFormData({ ...formData, domain: e.target.value })}
              placeholder="acme.example.com"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Tenant"}
            </Button>
          </div>
        </form>
      </Modal>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p>Loading tenants...</p>
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No tenants found.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Domain</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Users</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {tenant.domain || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {tenant._count?.users || 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          tenant.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {tenant.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}