"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, vendorsApi, productsApi, salesOrdersApi, rfqsApi, leadsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Plus, Package, Truck, CheckCircle, XCircle, Eye, Pencil, Trash2, Loader2, ShoppingCart, Send, FileText, ClipboardList, UserPlus, Target, TrendingUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PARTIAL: "bg-orange-100 text-orange-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  RECEIVED: "bg-green-100 text-green-800",
  SHIPPED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  ACCEPTED: "bg-green-100 text-green-800",
  NEW: "bg-blue-50 text-blue-700",
  QUALIFIED: "bg-emerald-50 text-emerald-700",
  CONVERTED: "bg-gray-50 text-gray-500",
};

type TabType = "purchase" | "rfq" | "sales" | "leads" | "vendors";

export default function SupplyChainPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("purchase");

  // State for modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewType, setViewType] = useState<TabType | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Selection states
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState("");

  // Form states
  const [formData, setFormData] = useState({
    vendorId: "",
    items: [{ productId: "", quantity: 1, unitPrice: 0 }],
    notes: "",
  });

  const [rfqFormData, setRfqFormData] = useState({
    vendorId: "",
    items: [{ productId: "", quantity: 1, targetPrice: 0 }],
    notes: "",
    expiryDate: "",
  });

  const [salesFormData, setSalesFormData] = useState({
    customerId: "",
    status: "PENDING",
    items: [{ productId: "", quantity: 1, unitPrice: 0 }],
    notes: "",
  });

  // Queries
  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => purchaseOrdersApi.getAll(),
  });

  const { data: rfqData, isLoading: rfqLoading } = useQuery({
    queryKey: ["rfqs"],
    queryFn: () => rfqsApi.getAll(),
    enabled: activeTab === "rfq",
  });

  const { data: soData, isLoading: soLoading } = useQuery({
    queryKey: ["sales-orders"],
    queryFn: () => salesOrdersApi.getAll(),
    enabled: activeTab === "sales",
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => leadsApi.getAll(),
    enabled: activeTab === "leads",
  });

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => vendorsApi.getAll(),
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.getAll(),
  });

  // Mutations
  const createPOMutation = useMutation({
    mutationFn: (data: any) => purchaseOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setIsModalOpen(false);
      toast.success("Purchase order created");
      setFormData({ vendorId: "", items: [{ productId: "", quantity: 1, unitPrice: 0 }], notes: "" });
    },
    onError: () => toast.error("Failed to create purchase order"),
  });

  const createSOMutation = useMutation({
    mutationFn: (data: any) => salesOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsSalesModalOpen(false);
      toast.success("Sales order created & inventory reserved");
      setSalesFormData({ customerId: "", status: "PENDING", items: [{ productId: "", quantity: 1, unitPrice: 0 }], notes: "" });
    },
    onError: (err: any) => toast.error("Failed to create sales order", { description: err.message }),
  });

  const updateSOStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => salesOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Sales order status updated");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order approved");
    },
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, items }: { id: string, items: any[] }) => purchaseOrdersApi.receive(id, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsReceiveModalOpen(false);
      toast.success("Items received & inventory updated");
    },
    onError: (err: any) => toast.error("Failed to receive items", { description: err.message }),
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, items, notes }: { id: string, items: any[], notes: string }) => 
      purchaseOrdersApi.returnItems(id, { items, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsReturnModalOpen(false);
      setReturnQtys({});
      setReturnNotes("");
      toast.success("Return processed and debit note created");
    },
    onError: (err: any) => toast.error("Return failed", { description: err.message }),
  });

  const createRFQMutation = useMutation({
    mutationFn: (data: any) => rfqsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      setIsRfqModalOpen(false);
      toast.success("RFQ created successfully");
      setRfqFormData({ vendorId: "", items: [{ productId: "", quantity: 1, targetPrice: 0 }], notes: "", expiryDate: "" });
    },
    onError: (err: any) => toast.error("Failed to create RFQ", { description: err.message }),
  });

  const convertRFQToPOMutation = useMutation({
    mutationFn: (id: string) => rfqsApi.convertToPO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("RFQ converted to Draft PO");
    },
    onError: (err: any) => toast.error("Conversion failed", { description: err.message }),
  });

  const convertLeadMutation = useMutation({
    mutationFn: (id: string) => leadsApi.convertToCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Lead converted to customer!");
    },
    onError: (err: any) => toast.error("Conversion failed", { description: err.message }),
  });

  // Handlers
  const handleOpenReceive = (po: any) => {
    setSelectedPO(po);
    const initialQtys: Record<string, number> = {};
    po.lines.forEach((line: any) => {
      initialQtys[line.id] = line.quantity - (line.receivedQty || 0);
    });
    setReceivedQtys(initialQtys);
    setIsReceiveModalOpen(true);
  };

  const handleOpenReturn = (po: any) => {
    setSelectedPO(po);
    const initialQtys: Record<string, number> = {};
    po.lines.filter((l: any) => l.receivedQty > 0).forEach((line: any) => {
      initialQtys[line.id] = 0;
    });
    setReturnQtys(initialQtys);
    setIsReturnModalOpen(true);
  };

  const handleViewPerformance = async (id: string) => {
    setSelectedVendorId(id);
    setIsPerformanceModalOpen(true);
    setPerformanceData(null);
    try {
      const data = await vendorsApi.getPerformance(id);
      setPerformanceData(data);
    } catch (err) {
      toast.error("Failed to fetch performance data");
    }
  };

  const handleView = (type: TabType, item: any) => {
    setViewType(type);
    setSelectedItem(item);
    setIsViewModalOpen(true);
  };

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(receivedQtys)
      .filter(([_, qty]) => qty > 0)
      .map(([lineId, quantity]) => ({ lineId, quantity }));
    
    if (items.length === 0) {
      toast.error("Please enter at least one quantity to receive");
      return;
    }

    receiveMutation.mutate({ id: selectedPO.id, items });
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(returnQtys)
      .filter(([_, qty]) => qty > 0)
      .map(([lineId, quantity]) => ({ lineId, quantity }));
    
    if (items.length === 0) {
      toast.error("Please enter at least one quantity to return");
      return;
    }

    returnMutation.mutate({ id: selectedPO.id, items, notes: returnNotes });
  };

  const totalAmount = formData.items.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice),
    0
  );

  const isPOValid = formData.vendorId && 
    formData.items.length > 0 && 
    formData.items.every(item => item.productId && item.quantity > 0 && item.unitPrice > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPOValid) return;
    createPOMutation.mutate({ ...formData, totalAmount });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: "", quantity: 1, unitPrice: 0 }],
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  const stats = {
    po: poData ? {
      total: poData.length,
      pending: poData.filter((po: any) => po.status === "PENDING").length,
      approved: poData.filter((po: any) => po.status === "APPROVED").length,
      received: poData.filter((po: any) => po.status === "RECEIVED").length,
    } : { total: 0, pending: 0, approved: 0, received: 0 },
    so: soData ? {
      total: soData.length,
      pending: soData.filter((so: any) => so.status === "PENDING").length,
      confirmed: soData.filter((so: any) => so.status === "CONFIRMED").length,
      shipped: soData.filter((so: any) => so.status === "SHIPPED").length,
    } : { total: 0, pending: 0, confirmed: 0, shipped: 0 }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Supply Chain</h1>
        {activeTab === "purchase" ? (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        ) : activeTab === "rfq" ? (
          <Button onClick={() => setIsRfqModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" />
            New RFQ
          </Button>
        ) : activeTab === "sales" ? (
          <Button onClick={() => setIsSalesModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            New Sales Order
          </Button>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab("purchase")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "purchase" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab("rfq")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "rfq" ? "border-emerald-600 text-emerald-600" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          RFQs
        </button>
        <button
          onClick={() => setActiveTab("leads")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "leads" ? "border-orange-600 text-orange-600" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Target className="h-4 w-4" />
          Leads
        </button>
        <button
          onClick={() => setActiveTab("sales")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "sales" ? "border-indigo-600 text-indigo-600" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          Sales Orders
        </button>
        <button
          onClick={() => setActiveTab("vendors")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "vendors" ? "border-emerald-600 text-emerald-600" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="h-4 w-4" />
          Vendors
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total {activeTab === 'purchase' ? 'POs' : activeTab === 'rfq' ? 'RFQs' : activeTab === 'leads' ? 'Leads' : 'SOs'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeTab === 'purchase' ? stats.po.total : 
               activeTab === 'rfq' ? (rfqData?.length || 0) : 
               activeTab === 'leads' ? (leadsData?.length || 0) :
               stats.so.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending / New</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${activeTab === 'purchase' ? 'text-yellow-600' : activeTab === 'rfq' ? 'text-emerald-600' : activeTab === 'leads' ? 'text-blue-600' : 'text-orange-600'}`}>
              {activeTab === 'purchase' ? stats.po.pending : 
               activeTab === 'rfq' ? (rfqData?.filter((r: any) => r.status === 'PENDING').length || 0) : 
               activeTab === 'leads' ? (leadsData?.filter((l: any) => l.status === 'NEW').length || 0) :
               stats.so.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{activeTab === 'purchase' ? 'Approved' : activeTab === 'rfq' ? 'Accepted' : activeTab === 'leads' ? 'Qualified' : 'Confirmed'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${activeTab === 'purchase' ? 'text-blue-600' : activeTab === 'rfq' ? 'text-green-600' : activeTab === 'leads' ? 'text-emerald-600' : 'text-indigo-600'}`}>
              {activeTab === 'purchase' ? stats.po.approved : 
               activeTab === 'rfq' ? (rfqData?.filter((r: any) => r.status === 'ACCEPTED').length || 0) : 
               activeTab === 'leads' ? (leadsData?.filter((l: any) => l.status === 'QUALIFIED').length || 0) :
               stats.so.confirmed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{activeTab === 'purchase' ? 'Received' : activeTab === 'rfq' ? 'Expired' : activeTab === 'leads' ? 'Converted' : 'Shipped'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${activeTab === 'purchase' ? 'text-green-600' : activeTab === 'rfq' ? 'text-red-600' : activeTab === 'leads' ? 'text-gray-600' : 'text-emerald-600'}`}>
              {activeTab === 'purchase' ? stats.po.received : 
               activeTab === 'rfq' ? (rfqData?.filter((r: any) => r.status === 'EXPIRED').length || 0) : 
               activeTab === 'leads' ? (leadsData?.filter((l: any) => l.status === 'CONVERTED').length || 0) :
               stats.so.shipped}
            </div>
          </CardContent>
        </Card>
      </div>

      {activeTab === "purchase" && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {poLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-4">
                {poData && poData.length > 0 ? (
                  poData.map((po: any) => (
                    <div key={po.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">PO-{po.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {po.vendor?.name || "Unknown Vendor"} • {po.lines?.length || 0} items
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(Number(po.totalAmount || 0))}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={statusColors[po.status] || "bg-gray-100"}>
                          {po.status?.replace(/_/g, " ")}
                        </Badge>
                        <div className="flex gap-1">
                          {po.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveMutation.mutate(po.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {(po.status === "APPROVED" || po.status === "PARTIAL") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReceive(po)}
                              title="Receive Items"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}
                          {(po.status === "RECEIVED" || po.status === "PARTIAL" || po.status === "RETURN") && po.lines.some((l: any) => l.receivedQty > 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReturn(po)}
                              className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              title="Return Items"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleView("purchase", po)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No purchase orders found. Create your first order.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "rfq" && (
        <Card>
          <CardHeader>
            <CardTitle>Request For Quotes (RFQs)</CardTitle>
          </CardHeader>
          <CardContent>
            {rfqLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-4">
                {rfqData && rfqData.length > 0 ? (
                  <div className="space-y-4">
                    {rfqData.map((rfq: any) => (
                      <div key={rfq.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <ClipboardList className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{rfq.rfqNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {rfq.vendor?.name} • {rfq._count?.lines || 0} items
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right mr-4">
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Expiry</p>
                            <p className={`text-sm ${new Date(rfq.expiryDate) < new Date() ? 'text-red-500 font-bold' : ''}`}>
                              {rfq.expiryDate ? new Date(rfq.expiryDate).toLocaleDateString() : 'No expiry'}
                            </p>
                          </div>
                          <Badge className={statusColors[rfq.status] || "bg-gray-100"}>
                            {rfq.status}
                          </Badge>
                          <div className="flex gap-2 ml-4">
                            {rfq.status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => convertRFQToPOMutation.mutate(rfq.id)}
                                disabled={convertRFQToPOMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Accept & Convert
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleView("rfq", rfq)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No RFQs found. Send a quote request to a vendor.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "leads" && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-4">
                {leadsData && leadsData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Lead</th>
                          <th className="px-4 py-3 text-left font-semibold">Contact</th>
                          <th className="px-4 py-3 text-left font-semibold">Source</th>
                          <th className="px-4 py-3 text-center font-semibold">Status</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {leadsData.map((l: any) => (
                          <tr key={l.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <p className="font-medium">{l.companyName}</p>
                              <p className="text-xs text-muted-foreground">{l.description}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p>{l.contactName}</p>
                              <p className="text-xs text-muted-foreground">{l.email}</p>
                            </td>
                            <td className="px-4 py-3">{l.source}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={statusColors[l.status] || "bg-gray-100"}>
                                {l.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {l.status !== 'CONVERTED' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                    onClick={() => convertLeadMutation.mutate(l.id)}
                                    disabled={convertLeadMutation.isPending}
                                  >
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Convert
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleView("leads", l)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No active leads found. Use the CRM to track potential customers.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "sales" && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {soLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-4">
                {soData && soData.length > 0 ? (
                  <div className="space-y-4">
                    {soData.map((so: any) => (
                      <div key={so.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <ShoppingCart className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium">{so.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {so.customer?.name || "Walk-in Customer"} • {so._count?.lines || 0} items
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right mr-4">
                            <p className="font-medium">{formatCurrency(Number(so.totalAmount || 0))}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(so.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={statusColors[so.status] || "bg-gray-100"}>
                            {so.status?.replace(/_/g, " ")}
                          </Badge>
                          <div className="flex gap-2 ml-4">
                            {so.status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                onClick={() => updateSOStatusMutation.mutate({ id: so.id, status: "CONFIRMED" })}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirm
                              </Button>
                            )}
                            {so.status === "CONFIRMED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => updateSOStatusMutation.mutate({ id: so.id, status: "SHIPPED" })}
                                disabled={updateSOStatusMutation.isPending}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Ship Order
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleView("sales", so)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No sales orders found. Create your first order.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "vendors" && (
        <Card>
          <CardHeader>
            <CardTitle>Vendor Directory</CardTitle>
          </CardHeader>
          <CardContent>
            {vendorsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-4">
                {vendorsData && vendorsData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                          <th className="px-4 py-3 text-left font-semibold">Code</th>
                          <th className="px-4 py-3 text-left font-semibold">Email</th>
                          <th className="px-4 py-3 text-center font-semibold">Products</th>
                          <th className="px-4 py-3 text-center font-semibold">POs</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {vendorsData.map((v: any) => (
                          <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium">{v.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{v.code}</td>
                            <td className="px-4 py-3 text-muted-foreground">{v.email || '-'}</td>
                            <td className="px-4 py-3 text-center">{v._count?.products || 0}</td>
                            <td className="px-4 py-3 text-center">{v._count?.purchaseOrders || 0}</td>
                            <td className="px-4 py-3 text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => handleViewPerformance(v.id)}
                              >
                                <TrendingUp className="h-4 w-4 mr-1" />
                                Performance
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No vendors found.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Purchase Order">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Vendor</label>
            <select
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
            >
              <option value="">Select Vendor</option>
              {vendorsData?.map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Items</label>
            {formData.items.map((item, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <select
                    className="w-full h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={item.productId}
                    onChange={(e) => updateItem(index, "productId", e.target.value)}
                  >
                    <option value="">Select Product</option>
                    {productsData?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                  className="w-20"
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                  className="w-24"
                />
                {formData.items.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              Add Item
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium">Total Amount:</span>
            <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPOMutation.isPending || !isPOValid}>
              {createPOMutation.isPending ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isRfqModalOpen} onClose={() => setIsRfqModalOpen(false)} title="Create Request for Quote (RFQ)">
        <form onSubmit={(e) => { e.preventDefault(); createRFQMutation.mutate(rfqFormData); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendor</label>
              <select
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={rfqFormData.vendorId}
                onChange={(e) => setRfqFormData({ ...rfqFormData, vendorId: e.target.value })}
                required
              >
                <option value="">Select Vendor</option>
                {vendorsData?.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expiry Date</label>
              <Input
                type="date"
                value={rfqFormData.expiryDate}
                onChange={(e) => setRfqFormData({ ...rfqFormData, expiryDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Items Requested</label>
            {rfqFormData.items.map((item, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <select
                    className="w-full h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    value={item.productId}
                    onChange={(e) => {
                      const newItems = [...rfqFormData.items];
                      newItems[index].productId = e.target.value;
                      setRfqFormData({ ...rfqFormData, items: newItems });
                    }}
                    required
                  >
                    <option value="">Select Product</option>
                    {productsData?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...rfqFormData.items];
                    newItems[index].quantity = Number(e.target.value);
                    setRfqFormData({ ...rfqFormData, items: newItems });
                  }}
                  className="w-20"
                />
                <Input
                  type="number"
                  placeholder="Target"
                  value={item.targetPrice}
                  onChange={(e) => {
                    const newItems = [...rfqFormData.items];
                    newItems[index].targetPrice = Number(e.target.value);
                    setRfqFormData({ ...rfqFormData, items: newItems });
                  }}
                  className="w-24"
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    const newItems = rfqFormData.items.filter((_, i) => i !== index);
                    setRfqFormData({ ...rfqFormData, items: newItems.length ? newItems : [{ productId: "", quantity: 1, targetPrice: 0 }] });
                  }}
                >
                  <XCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => setRfqFormData({ ...rfqFormData, items: [...rfqFormData.items, { productId: "", quantity: 1, targetPrice: 0 }] })}
            >
              Add Item
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes / Terms</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              value={rfqFormData.notes}
              onChange={(e) => setRfqFormData({ ...rfqFormData, notes: e.target.value })}
              placeholder="Shipping terms, volume discounts expected, etc."
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsRfqModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={createRFQMutation.isPending}>
              {createRFQMutation.isPending ? "Sending RFQ..." : "Send Quote Request"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isSalesModalOpen} onClose={() => setIsSalesModalOpen(false)} title="Create Sales Order">
        <form onSubmit={(e) => { e.preventDefault(); createSOMutation.mutate(salesFormData); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer</label>
              <select
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={salesFormData.customerId}
                onChange={(e) => setSalesFormData({ ...salesFormData, customerId: e.target.value })}
              >
                <option value="">Walk-in Customer</option>
                {/* Normally we would map customers here */}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Status</label>
              <select
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={salesFormData.status}
                onChange={(e) => setSalesFormData({ ...salesFormData, status: e.target.value })}
              >
                <option value="DRAFT">Draft (No reservation)</option>
                <option value="PENDING">Pending (Reserve stock)</option>
                <option value="CONFIRMED">Confirmed (Reserve stock)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Items</label>
            {salesFormData.items.map((item, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <select
                    className="w-full h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={item.productId}
                    onChange={(e) => {
                      const newItems = [...salesFormData.items];
                      newItems[index].productId = e.target.value;
                      // Auto-fill price from product list if available
                      const prod = productsData?.find((p: any) => p.id === e.target.value);
                      if (prod) newItems[index].unitPrice = Number(prod.unitPrice);
                      setSalesFormData({ ...salesFormData, items: newItems });
                    }}
                  >
                    <option value="">Select Product</option>
                    {productsData?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...salesFormData.items];
                    newItems[index].quantity = Number(e.target.value);
                    setSalesFormData({ ...salesFormData, items: newItems });
                  }}
                  className="w-20"
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => {
                    const newItems = [...salesFormData.items];
                    newItems[index].unitPrice = Number(e.target.value);
                    setSalesFormData({ ...salesFormData, items: newItems });
                  }}
                  className="w-24"
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    const newItems = salesFormData.items.filter((_, i) => i !== index);
                    setSalesFormData({ ...salesFormData, items: newItems.length ? newItems : [{ productId: "", quantity: 1, unitPrice: 0 }] });
                  }}
                >
                  <XCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => setSalesFormData({ ...salesFormData, items: [...salesFormData.items, { productId: "", quantity: 1, unitPrice: 0 }] })}
            >
              Add Item
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              value={salesFormData.notes}
              onChange={(e) => setSalesFormData({ ...salesFormData, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsSalesModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createSOMutation.isPending}>
              {createSOMutation.isPending ? "Creating..." : "Create Sales Order"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} title="Receive PO Items">
        <form onSubmit={handleReceiveSubmit} className="space-y-4">
          {selectedPO && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Receiving items for <span className="font-bold">PO-{selectedPO.id.slice(0, 8)}</span>
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-center">Ordered</th>
                      <th className="px-3 py-2 text-center">Received</th>
                      <th className="px-3 py-2 text-right">To Receive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedPO.lines.map((line: any) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{line.product?.name}</p>
                          <p className="text-xs text-gray-500">{line.product?.sku}</p>
                        </td>
                        <td className="px-3 py-2 text-center">{line.quantity}</td>
                        <td className="px-3 py-2 text-center text-green-600">{line.receivedQty || 0}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            max={line.quantity - (line.receivedQty || 0)}
                            className="w-20 ml-auto h-8 text-right"
                            value={receivedQtys[line.id] || 0}
                            onChange={(e) => setReceivedQtys({ ...receivedQtys, [line.id]: Number(e.target.value) })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsReceiveModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? "Receiving..." : "Confirm Receipt"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPerformanceModalOpen} onClose={() => setIsPerformanceModalOpen(false)} title="Vendor Performance Metrics">
        {!performanceData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">On-Time Delivery</p>
                <p className="text-3xl font-bold text-blue-900">{performanceData.onTimeRate || '0%'}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Quality Score</p>
                <p className="text-3xl font-bold text-emerald-900">{performanceData.qualityScore || '100%'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-tight">Supply Chain Reliability</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Total Purchase Orders</span>
                  <span className="font-bold">{performanceData.totalPOs}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Product Returns (RMAs)</span>
                  <span className="font-bold text-red-600">{performanceData.totalReturns}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Performance Status</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-none">{performanceData.status}</Badge>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-dashed text-center">
              <p className="text-xs text-muted-foreground italic">
                Performance is calculated based on expected vs actual delivery dates and item return rates.
              </p>
            </div>
          </div>
        )}
        <div className="flex justify-end mt-8">
          <Button onClick={() => setIsPerformanceModalOpen(false)}>Close</Button>
        </div>
      </Modal>

      <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Process Purchase Return">
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {selectedPO && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 rounded-lg text-red-800 text-sm mb-4">
                Creating Debit Note for <span className="font-bold">PO-{selectedPO.id.slice(0, 8)}</span>
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-center">Received</th>
                      <th className="px-3 py-2 text-right">Qty to Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedPO.lines.filter((l: any) => l.receivedQty > 0).map((line: any) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{line.product?.name}</p>
                          <p className="text-xs text-gray-500">{line.product?.sku}</p>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-green-600">{line.receivedQty}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            max={line.receivedQty}
                            className="w-20 ml-auto h-8 text-right border-red-200 focus:ring-red-500"
                            value={returnQtys[line.id] || 0}
                            onChange={(e) => setReturnQtys({ ...returnQtys, [line.id]: Number(e.target.value) })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Return Reason</label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-md" 
                  rows={2}
                  placeholder="Defective, wrong item, etc."
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              disabled={returnMutation.isPending}
            >
              {returnMutation.isPending ? "Processing..." : "Confirm Return & Debit Note"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={`${viewType?.toUpperCase()} Detail View`}>
        {selectedItem && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Reference</p>
                <p className="font-bold">{selectedItem.rfqNumber || selectedItem.orderNumber || (selectedItem.id && `ID-${selectedItem.id.slice(0, 8)}`)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Status</p>
                <Badge className={statusColors[selectedItem.status] || "bg-gray-100"}>
                  {selectedItem.status?.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">{viewType === 'leads' ? 'Contact' : 'Partner'}</p>
                <p>{selectedItem.vendor?.name || selectedItem.customer?.name || selectedItem.contactName || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Date</p>
                <p>{new Date(selectedItem.createdAt || selectedItem.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>

            {viewType === 'leads' && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Company</p>
                  <p className="font-medium">{selectedItem.companyName}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Email</p>
                  <p>{selectedItem.email}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Description</p>
                  <p className="text-sm">{selectedItem.description || "No description provided."}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Source</p>
                  <p className="text-sm">{selectedItem.source}</p>
                </div>
              </div>
            )}

            {(viewType === 'purchase' || viewType === 'sales' || viewType === 'rfq') && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Items</p>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        {viewType !== 'rfq' && <th className="px-3 py-2 text-right">Price</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(selectedItem.lines || []).map((line: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <p className="font-medium">{line.product?.name || "Unknown Product"}</p>
                            <p className="text-xs text-muted-foreground">{line.product?.sku}</p>
                          </td>
                          <td className="px-3 py-2 text-center">{line.quantity}</td>
                          {viewType !== 'rfq' && (
                            <td className="px-3 py-2 text-right">
                              {formatCurrency(Number(line.unitPrice || 0))}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {viewType !== 'rfq' && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg mt-2">
                    <span className="font-semibold text-sm">Total Amount</span>
                    <span className="font-bold text-lg">{formatCurrency(Number(selectedItem.totalAmount || 0))}</span>
                  </div>
                )}
              </div>
            )}

            {selectedItem.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Notes</p>
                <div className="p-3 bg-gray-50 rounded-lg text-sm italic">
                  "{selectedItem.notes}"
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end mt-6">
          <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
