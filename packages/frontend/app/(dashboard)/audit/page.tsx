"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { auditApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store/useAuthStore";

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-purple-100 text-purple-800",
  LOGOUT: "bg-gray-100 text-gray-800",
};

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const canExport = user?.role === 'superadmin' || user?.role === 'admin';

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", page, actionFilter],
    queryFn: () => auditApi.getLogs({ page, limit: 20, action: actionFilter || undefined }),
  });

  const handleExport = async () => {
    try {
      const data = await auditApi.exportLogs();
      // Create CSV download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit logs exported");
    } catch (err) {
      toast.error("Failed to export logs");
    }
  };

  const logs: any[] = logsData?.data || [];
  const filteredLogs = logs.filter((log: any) => 
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        {canExport && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                >
                  <div className="flex items-center gap-4">
                    <Badge className={actionColors[log.action] || "bg-gray-100"}>
                      {log.action}
                    </Badge>
                    <div>
                      <p className="font-medium">{log.entityType}</p>
                      <p className="text-sm text-muted-foreground">{log.user?.email || log.user?.name || 'System'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {logsData?.total > page * 20 && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => setPage(p => p + 1)}>
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}