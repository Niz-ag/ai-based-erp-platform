"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Plus, Webhook as WebhookIcon, Trash2, Play, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { webhooksApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store/useAuthStore";

const availableEvents = [
  "employee.created", "employee.updated", "employee.deleted",
  "purchase_order.created", "purchase_order.approved", "purchase_order.received",
  "invoice.created", "invoice.paid", "invoice.overdue",
  "leave_request.created", "leave_request.approved", "leave_request.rejected",
  "user.login", "user.logout",
];

export default function WebhooksPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ url: "", events: [] as string[], secret: "" });
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const userRole = user?.role?.name?.toLowerCase();
  const canManage = userRole === 'superadmin' || userRole === 'admin' || userRole === 'manager';

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => webhooksApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => webhooksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsModalOpen(false);
      setFormData({ url: "", events: [], secret: "" });
      setSelectedEvents([]);
      toast.success("Webhook created");
    },
    onError: () => toast.error("Failed to create webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted");
    },
    onError: () => toast.error("Failed to delete webhook"),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.test(id),
    onSuccess: () => toast.success("Test payload sent"),
    onError: () => toast.error("Test failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url) {
      toast.error("URL is required");
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error("Select at least one event");
      return;
    }
    createMutation.mutate({ url: formData.url, events: selectedEvents, secret: formData.secret });
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev => 
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const webhookList = webhooks || [];

  return (
    <div className="p-6 space-y-6">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Webhook">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Endpoint URL</label>
            <Input 
              placeholder="https://..."
              value={formData.url}
              onChange={e => setFormData({ ...formData, url: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Secret (optional)</label>
            <Input 
              placeholder="Secret for signature verification"
              value={formData.secret}
              onChange={e => setFormData({ ...formData, secret: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Events</label>
            <div className="flex flex-wrap gap-2">
              {availableEvents.map(event => (
                <Badge 
                  key={event} 
                  variant={selectedEvents.includes(event) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleEvent(event)}
                >
                  {event}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Webhook"}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Webhooks</h1>
        {canManage && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Webhook
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoint Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : webhookList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhooks configured. {canManage && "Click 'Add Webhook' to get started."}
            </div>
          ) : (
            <div className="space-y-4">
              {webhookList.map((webhook: any) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <WebhookIcon className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium break-all">{webhook.url}</p>
                      <div className="flex gap-1 mt-1">
                        {(webhook.events || []).map((event: string) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={webhook.isActive ? "default" : "secondary"}>
                      {webhook.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => testMutation.mutate(webhook.id)}>
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(webhook.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            These events can be subscribed to via webhooks:
          </p>
          <div className="flex flex-wrap gap-2">
            {availableEvents.map(event => (
              <Badge key={event} variant="outline" className="text-xs">
                {event}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}