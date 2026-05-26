"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, inventoryApi, vendorsApi, purchaseOrdersApi } from "@/lib/api";
import { Package, AlertTriangle, ShoppingCart, Plus, Check, X, Truck, Loader2, Warehouse, Edit3, TrendingUp, BrainCircuit } from "lucide-react"
import { toast } from "sonner";;
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from "recharts";
import { forecastApi } from "@/lib/api";

type TabType = "products" | "inventory" | "lowstock" | "purchaseorders" | "vendors" | "forecast";

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantity: 0,
    notes: "",
  });

  const adjustMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.adjust(selectedInventoryItem.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      setIsAdjustmentModalOpen(false);
      toast.success("Inventory adjusted successfully");
    },
    onError: () => toast.error("Failed to adjust inventory"),
  });

  const approvePOMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order approved");
    },
    onError: () => toast.error("Failed to approve PO"),
  });

  const receivePOMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.receive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Items received and inventory updated");
    },
    onError: () => toast.error("Failed to receive PO"),
  });
  const [productForm, setProductData] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    unit: "PCS",
    unitPrice: 0,
    reorderThreshold: 10,
    vendorId: "",
  });

  const [vendorForm, setVendorData] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
  });

  const [poForm, setPOData] = useState({
    vendorId: "",
    orderDate: new Date().toISOString().split('T')[0],
    notes: "",
    items: [{ productId: "", quantity: 1, unitPrice: 0 }],
  });

  // Data fetching
  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.getAll(),
  });

  const { data: inventoryData, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => inventoryApi.getAll(),
  });

  const { data: lowStockData, isLoading: lowStockLoading } = useQuery({
    queryKey: ["low-stock"],
    queryFn: () => inventoryApi.getLowStock(),
  });

  const { data: purchaseOrdersData, isLoading: poLoading, refetch: refetchPOs } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => purchaseOrdersApi.getAll(),
  });

  const { data: vendorsData, isLoading: vendorsLoading, refetch: refetchVendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => vendorsApi.getAll(),
  });

  // Handlers
  const [selectedSku, setSelectedSku] = useState<string>("");

  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ["forecast", selectedSku],
    queryFn: () => forecastApi.getForecast(selectedSku),
    enabled: !!selectedSku && activeTab === "forecast",
  });

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await productsApi.create(productForm);
      setIsProductModalOpen(false);
      setProductData({ sku: "", name: "", description: "", category: "", unit: "PCS", unitPrice: 0, reorderThreshold: 10, vendorId: "" });
      refetchProducts();
    } catch (err: any) {
      toast.error("Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await vendorsApi.create(vendorForm);
      setIsVendorModalOpen(false);
      setVendorData({ name: "", code: "", email: "", phone: "", address: "" });
      refetchVendors();
    } catch (err: any) {
      toast.error("Failed to create vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await purchaseOrdersApi.create(poForm);
      setIsPOModalOpen(false);
      setPOData({ vendorId: "", orderDate: new Date().toISOString().split('T')[0], notes: "", items: [{ productId: "", quantity: 1, unitPrice: 0 }] });
      refetchPOs();
    } catch (err: any) {
      toast.error("Failed to create PO");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: "products" as TabType, label: "Products", icon: Package },
    { id: "inventory" as TabType, label: "Stock Levels", icon: Warehouse },
    { id: "lowstock" as TabType, label: "Low Stock", icon: AlertTriangle },
    { id: "purchaseorders" as TabType, label: "Purchase Orders", icon: ShoppingCart },
    { id: "vendors" as TabType, label: "Vendors", icon: Truck },
    { id: "forecast" as TabType, label: "AI Forecast", icon: BrainCircuit },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage products, supply chain, and warehouse</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "products" && (
            <Button onClick={() => setIsProductModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          )}
          {activeTab === "vendors" && (
            <Button onClick={() => setIsVendorModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Vendor
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === "lowstock" && (lowStockData?.length ?? 0) > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">
                {lowStockData?.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Modals */}
      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title="Add New Product">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">SKU</label>
              <input required className="w-full px-3 py-2 border rounded-md" value={productForm.sku} onChange={e => setProductData({...productForm, sku: e.target.value})} placeholder="PROD-001" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <input className="w-full px-3 py-2 border rounded-md" value={productForm.category} onChange={e => setProductData({...productForm, category: e.target.value})} placeholder="Electronics" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Name</label>
            <input required className="w-full px-3 py-2 border rounded-md" value={productForm.name} onChange={e => setProductData({...productForm, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Unit Price</label>
              <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-md" value={productForm.unitPrice} onChange={e => setProductData({...productForm, unitPrice: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reorder Threshold</label>
              <input type="number" className="w-full px-3 py-2 border rounded-md" value={productForm.reorderThreshold} onChange={e => setProductData({...productForm, reorderThreshold: Number(e.target.value)})} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsProductModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Product"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} title="Add New Vendor">
        <form onSubmit={handleAddVendor} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendor Name</label>
              <input required className="w-full px-3 py-2 border rounded-md" value={vendorForm.name} onChange={e => setVendorData({...vendorForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendor Code</label>
              <input required className="w-full px-3 py-2 border rounded-md" value={vendorForm.code} onChange={e => setVendorData({...vendorForm, code: e.target.value})} placeholder="VND001" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input type="email" className="w-full px-3 py-2 border rounded-md" value={vendorForm.email} onChange={e => setVendorData({...vendorForm, email: e.target.value})} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsVendorModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Vendor"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} title="Adjust Stock Level">
        <form onSubmit={(e) => { e.preventDefault(); adjustMutation.mutate(adjustmentForm); }} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Product</label>
            <p className="text-sm text-muted-foreground">{selectedInventoryItem?.product?.name}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Quantity</label>
            <input 
              type="number" 
              required 
              className="w-full px-3 py-2 border rounded-md" 
              value={adjustmentForm.quantity} 
              onChange={e => setAdjustmentForm({...adjustmentForm, quantity: Number(e.target.value)})} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea 
              className="w-full px-3 py-2 border rounded-md" 
              value={adjustmentForm.notes} 
              onChange={e => setAdjustmentForm({...adjustmentForm, notes: e.target.value})} 
              placeholder="Cycle count, damage, etc."
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsAdjustmentModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={adjustMutation.isPending}>{adjustMutation.isPending ? "Adjusting..." : "Update Stock"}</Button>
          </div>
        </form>
      </Modal>

      {/* Content Sections */}
      {activeTab === "products" && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-left font-medium">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {productsLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></td></tr>
                ) : productsData && productsData.length > 0 ? (
                  productsData.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{p.sku}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">{p.category}</td>
                      <td className="px-4 py-3 text-right">${Number(p.unitPrice || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">{p.unit}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No products found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 text-right font-medium">Reorder Level</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventoryLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></td></tr>
                ) : inventoryData && inventoryData.length > 0 ? (
                  inventoryData.map((i: any) => (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{i.product?.name}</td>
                      <td className="px-4 py-3 text-right">{i.quantity}</td>
                      <td className="px-4 py-3 text-right">{i.product?.reorderThreshold}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${i.quantity <= (i.product?.reorderThreshold || 0) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {i.quantity <= (i.product?.reorderThreshold || 0) ? 'Low Stock' : 'Healthy'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedInventoryItem(i);
                            setAdjustmentForm({ quantity: i.quantity, notes: "" });
                            setIsAdjustmentModalOpen(true);
                          }}
                        >
                          <Edit3 className="h-4 w-4 mr-1" /> Adjust
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No inventory data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "purchaseorders" && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">PO Number</th>
                  <th className="px-4 py-3 text-left font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {poLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></td></tr>
                ) : purchaseOrdersData && purchaseOrdersData.length > 0 ? (
                  purchaseOrdersData.map((po: any) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{po.orderNumber}</td>
                      <td className="px-4 py-3">{po.vendor?.name}</td>
                      <td className="px-4 py-3">{new Date(po.orderDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">${Number(po.totalAmount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          po.status === 'RECEIVED' ? 'bg-green-100 text-green-700' :
                          po.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {po.status === 'PENDING' && (
                            <Button size="sm" variant="outline" onClick={() => approvePOMutation.mutate(po.id)}>
                              Approve
                            </Button>
                          )}
                          {po.status === 'APPROVED' && (
                            <Button size="sm" variant="outline" onClick={() => receivePOMutation.mutate(po.id)}>
                              Receive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No purchase orders.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "vendors" && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vendorsLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></td></tr>
                ) : vendorsData && vendorsData.length > 0 ? (
                  vendorsData.map((v: any) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{v.code}</td>
                      <td className="px-4 py-3 font-medium">{v.name}</td>
                      <td className="px-4 py-3">{v.email}</td>
                      <td className="px-4 py-3">{v.phone}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No vendors found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Forecast Tab Content */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-purple-600" />
                  Demand Forecasting
                </h3>
                <p className="text-sm text-muted-foreground">AI-powered SKU-level demand prediction</p>
              </div>
              <div className="w-full md:w-64">
                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Select Product SKU</label>
                <select 
                  className="w-full h-10 px-3 py-2 border rounded-md text-sm"
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                >
                  <option value="">Select SKU...</option>
                  {productsData?.map((p: any) => (
                    <option key={p.id} value={p.sku}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {forecastLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : !selectedSku ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Package className="h-12 w-12 mb-2 opacity-20" />
                <p>Select a product SKU to generate AI demand forecast</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
                    <p className="text-sm text-purple-700 font-medium">Trend Prediction</p>
                    <p className="text-2xl font-bold text-purple-900 capitalize mt-1">
                      {forecastData?.trend}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium">Next Month Prediction</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {forecastData?.forecasts?.[0]?.predicted || 0} units
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">Model Confidence</p>
                    <p className="text-2xl font-bold text-green-900 mt-1">85%</p>
                  </div>
                </div>

                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData?.forecasts || []}>
                      <defs>
                        <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="predicted" 
                        stroke="#8b5cf6" 
                        fillOpacity={1} 
                        fill="url(#colorPred)" 
                        name="Predicted Demand"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
