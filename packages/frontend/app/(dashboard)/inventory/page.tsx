"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { productsApi, inventoryApi, vendorsApi, purchaseOrdersApi, replenishmentApi, forecastApi } from "@/lib/api";
import { Package, AlertTriangle, ShoppingCart, Plus, Check, X, Truck, Loader2, Warehouse, Edit3, TrendingUp, BrainCircuit, History, Scan, Zap } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button, PermissionGuard } from "@/components";
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

type TabType = "products" | "inventory" | "lowstock" | "purchaseorders" | "vendors" | "forecast" | "activity";

export default function InventoryPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("products");

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      // Find product in data or fetch
      // For now, let's just trigger a search or highlight it in the list if loaded
      // setSearchTerm(id);
    }
  }, [searchParams]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);

  const [transferForm, setTransferForm] = useState({
    fromLocation: "Main",
    toLocation: "",
    quantity: 1,
    notes: "",
  });

  const transferMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.transfer({
      productId: selectedInventoryItem.productId,
      fromLocation: data.fromLocation,
      toLocation: data.toLocation,
      quantity: data.quantity,
      notes: data.notes
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsTransferModalOpen(false);
      setTransferForm({ fromLocation: "Main", toLocation: "", quantity: 1, notes: "" });
      toast.success("Stock transferred successfully");
    },
    onError: (err: any) => toast.error("Transfer failed", { description: err.message }),
  });

  const handleOpenTransfer = (item: any) => {
    setSelectedInventoryItem(item);
    setTransferForm({ ...transferForm, fromLocation: item.location || "Main" });
    setIsTransferModalOpen(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    transferMutation.mutate(transferForm);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedActivityProductId, setSelectedActivityProductId] = useState<string>("");

  // Form states
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantity: 0,
    reasonCode: "",
    notes: "",
  });

  const handleAdjust = async (id: string, quantity: number, reasonCode: string, notes: string) => {
    adjustMutation.mutate({ id, data: { quantity, reasonCode, notes } });
  };

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => inventoryApi.adjust(id, data),
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
    onError: (err: any) => toast.error("Failed to approve PO", { description: err.message }),
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
    barcode: "",
    description: "",
    category: "",
    unit: "ea",
    purchaseUnit: "ea",
    purchaseFactor: 1,
    unitPrice: 0,
    reorderThreshold: 10,
    vendorId: "",
    initialQuantity: 0,
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
    items: [{ productId: "", quantity: 1, unitPrice: 0, uom: "ea", uomFactor: 1 }],
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

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["inventory-history", selectedActivityProductId],
    queryFn: () => inventoryApi.getHistory(selectedActivityProductId),
    enabled: !!selectedActivityProductId && activeTab === "activity",
    });

    const replenishMutation = useMutation({
    mutationFn: () => replenishmentApi.run(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      toast.success("Auto-replenishment completed");
    },
    onError: (err: any) => toast.error("Replenishment failed", { description: err.message })
    });

    // Mutators
  const [selectedSku, setSelectedSku] = useState<string>("");

  const seedHistoricalData = async () => {
    if (!selectedSku) {
      toast.error("Please select a SKU first");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const data = [];
      // Generate 24 months of random data
      for (let i = 24; i >= 1; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        data.push({
          sku: selectedSku,
          quantity: Math.floor(Math.random() * 100) + 50,
          date: date.toISOString().split('T')[0]
        });
      }
      await forecastApi.bulkAddHistoricalData(data);
      queryClient.invalidateQueries({ queryKey: ["forecast", selectedSku] });
      toast.success("Historical data seeded successfully!");
    } catch (err) {
      toast.error("Failed to seed data");
    } finally {
      setIsSubmitting(false);
    }
  };

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
      setProductData({ sku: "", name: "", barcode: "", description: "", category: "", unit: "ea", purchaseUnit: "ea", purchaseFactor: 1, unitPrice: 0, reorderThreshold: 10, vendorId: "", initialQuantity: 0 });
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
      setPOData({ vendorId: "", orderDate: new Date().toISOString().split('T')[0], notes: "", items: [{ productId: "", quantity: 1, unitPrice: 0, uom: "ea", uomFactor: 1 }] });
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
    { id: "activity" as TabType, label: "Activity Log", icon: History },
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
            <PermissionGuard permissions="inventory_write">
              <Button onClick={() => setIsProductModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </PermissionGuard>
          )}
          {activeTab === "vendors" && (
            <PermissionGuard permissions="inventory_write">
              <Button onClick={() => setIsVendorModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Vendor
              </Button>
            </PermissionGuard>
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
              <label className="text-sm font-medium">Barcode (Optional)</label>
              <input className="w-full px-3 py-2 border rounded-md" value={productForm.barcode} onChange={e => setProductData({...productForm, barcode: e.target.value})} placeholder="123456789" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <input className="w-full px-3 py-2 border rounded-md" value={productForm.category} onChange={e => setProductData({...productForm, category: e.target.value})} placeholder="Electronics" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Name</label>
              <input required className="w-full px-3 py-2 border rounded-md" value={productForm.name} onChange={e => setProductData({...productForm, name: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Unit Price</label>
              <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-md" value={productForm.unitPrice} onChange={e => setProductData({...productForm, unitPrice: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Quantity</label>
              <input type="number" className="w-full px-3 py-2 border rounded-md" value={productForm.initialQuantity} onChange={e => setProductData({...productForm, initialQuantity: Number(e.target.value)})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reorder Threshold</label>
            <input type="number" className="w-full px-3 py-2 border rounded-md" value={productForm.reorderThreshold} onChange={e => setProductData({...productForm, reorderThreshold: Number(e.target.value)})} />
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
        <form onSubmit={(e) => { e.preventDefault(); adjustMutation.mutate({ id: selectedInventoryItem.id, data: adjustmentForm }); }} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Product</label>
            <p className="text-sm text-muted-foreground">{selectedInventoryItem?.product?.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className="text-sm font-medium">Reason Code</label>
              <select
                required
                className="w-full px-3 py-2 border rounded-md"
                value={adjustmentForm.reasonCode}
                onChange={e => setAdjustmentForm({...adjustmentForm, reasonCode: e.target.value})}
              >
                <option value="">Select Reason...</option>
                <option value="CORRECTION">Correction</option>
                <option value="DAMAGE">Damage</option>
                <option value="THEFT">Theft</option>
              </select>
            </div>
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
            <Button type="submit" disabled={adjustMutation.isPending || !adjustmentForm.reasonCode}>{adjustMutation.isPending ? "Adjusting..." : "Update Stock"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Transfer Stock Between Locations">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-800 text-sm mb-4">
            Product: <span className="font-bold">{selectedInventoryItem?.product?.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 uppercase">From Location</label>
              <input readOnly className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600" value={transferForm.fromLocation} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Location</label>
              <input 
                required 
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500" 
                placeholder="e.g., Warehouse B"
                value={transferForm.toLocation}
                onChange={e => setTransferForm({...transferForm, toLocation: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity to Transfer</label>
            <input 
              type="number" 
              required 
              min="1" 
              max={selectedInventoryItem?.quantity || 1} 
              className="w-full px-3 py-2 border rounded-md" 
              value={transferForm.quantity}
              onChange={e => setTransferForm({...transferForm, quantity: Number(e.target.value)})}
            />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Max Available: {selectedInventoryItem?.quantity || 0}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea 
              className="w-full px-3 py-2 border rounded-md" 
              rows={2}
              placeholder="Reason for transfer..."
              value={transferForm.notes}
              onChange={e => setTransferForm({...transferForm, notes: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsTransferModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={transferMutation.isPending || !transferForm.toLocation}>
              {transferMutation.isPending ? "Transferring..." : "Complete Transfer"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Content Sections */}
      {(activeTab === "inventory" || activeTab === "products") && (
        <div className="mb-4 bg-gray-50 p-4 rounded-lg border flex items-center gap-4">
          <div className="flex-1 max-w-md relative">
            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Scan Barcode for Quick Action..."
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const query = e.currentTarget.value;
                  if (!query) return;
                  try {
                    const product = await inventoryApi.search(query);
                    if (product) {
                      const mainInventory = product.inventory?.[0];
                      toast.success(`Product found: ${product.name}`, {
                        description: `SKU: ${product.sku} | Quantity: ${mainInventory?.quantity || 0}`,
                        action: mainInventory ? {
                          label: "Quick Add +1",
                          onClick: () => handleAdjust(mainInventory.id, (mainInventory.quantity || 0) + 1, "CORRECTION", "Barcode Quick Add")
                        } : undefined
                      });
                    } else {                      toast.error("Product not found");
                    }
                    e.currentTarget.value = "";
                  } catch (err) {
                    toast.error("Search failed");
                  }
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground italic">
            Tip: Press Enter after scanning to search or auto-increment stock.
          </p>
        </div>
      )}

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
                  inventoryData.map((item: any) => (
                    <tr key={item.id || item.productId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-right">{item.totalQuantity}</td>
                      <td className="px-4 py-3 text-right">{item.reorderThreshold}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${item.totalQuantity <= (item.reorderThreshold || 0) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {item.totalQuantity <= (item.reorderThreshold || 0) ? 'Low Stock' : 'Healthy'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <PermissionGuard permissions="inventory_write" mode="hide">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-blue-600"
                              onClick={() => handleOpenTransfer(item)}
                            >
                              <TrendingUp className="h-4 w-4 mr-1" /> Transfer
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permissions="inventory_write" mode="hide">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedInventoryItem(item);
                                setAdjustmentForm({ quantity: item.totalQuantity, reasonCode: "CORRECTION", notes: "" });
                                setIsAdjustmentModalOpen(true);
                              }}
                            >
                              <Edit3 className="h-4 w-4 mr-1" /> Adjust
                            </Button>
                          </PermissionGuard>
                        </div>
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

      {activeTab === "lowstock" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-red-50 p-4 rounded-lg border border-red-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Zap className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">Proactive Replenishment</h3>
                <p className="text-sm text-red-700">AI-driven automated PO generation for low-stock items.</p>
              </div>
            </div>
            <Button 
              onClick={() => replenishMutation.mutate()} 
              disabled={replenishMutation.isPending || (lowStockData?.length ?? 0) === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {replenishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Run Auto-Replenish
            </Button>
          </div>

          <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Product</th>
                    <th className="px-4 py-3 text-right font-medium">Current Stock</th>
                    <th className="px-4 py-3 text-right font-medium">Reorder Level</th>
                    <th className="px-4 py-3 text-right font-medium">Missing Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lowStockLoading ? (
                    <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6" /></td></tr>
                  ) : lowStockData && lowStockData.length > 0 ? (
                    lowStockData.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-bold">{item.totalQuantity}</td>
                        <td className="px-4 py-3 text-right">{item.reorderThreshold}</td>
                        <td className="px-4 py-3 text-right">{(item.reorderThreshold || 0) - (item.totalQuantity || 0)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => {
                            setPOData({
                              vendorId: item.vendorId || "",
                              orderDate: new Date().toISOString().split('T')[0],
                              notes: `Auto-replenish for ${item.name}`,
                              items: [{ productId: item.id, quantity: (item.reorderThreshold * 2) - item.totalQuantity, unitPrice: Number(item.unitPrice), uom: item.purchaseUnit || "ea", uomFactor: Number(item.purchaseFactor || 1) }]
                            });
                            setIsPOModalOpen(true);
                          }}>
                            Create PO
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">All stock levels are healthy.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
                            <PermissionGuard permissions="inventory_write" mode="hide">
                              <Button size="sm" variant="outline" onClick={() => approvePOMutation.mutate(po.id)}>
                                Approve
                              </Button>
                            </PermissionGuard>
                          )}
                          {po.status === 'APPROVED' && (
                            <PermissionGuard permissions="inventory_write" mode="hide">
                              <Button size="sm" variant="outline" onClick={() => receivePOMutation.mutate(po.id)}>
                                Receive
                              </Button>
                            </PermissionGuard>
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

      {/* Activity Log Tab Content */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  Inventory Activity Log
                </h3>
                <p className="text-sm text-muted-foreground">Historical record of SKU movements and adjustments</p>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  className="w-full h-10 px-3 py-2 border rounded-md text-sm"
                  value={selectedActivityProductId}
                  onChange={(e) => setSelectedActivityProductId(e.target.value)}
                >
                  <option value="">Select Product...</option>
                  {productsData?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {activityLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : !selectedActivityProductId ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <History className="h-12 w-12 mb-2 opacity-20" />
                <p>Select a product to view its transaction history</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-right font-medium">Quantity Change</th>
                      <th className="px-4 py-3 text-left font-medium">Performed By</th>
                      <th className="px-4 py-3 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activityData && activityData.length > 0 ? (
                      activityData.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              tx.type === 'PURCHASE' ? 'bg-green-100 text-green-700' :
                              tx.type === 'SALE' ? 'bg-blue-100 text-blue-700' :
                              tx.type === 'ADJUSTMENT' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                          </td>
                          <td className="px-4 py-3">
                            {tx.createdBy?.firstName} {tx.createdBy?.lastName}
                            <div className="text-xs text-muted-foreground">{tx.createdBy?.email}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                            {tx.notes || '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No transaction history found for this product.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
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
                <div className="flex items-center gap-2">
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
                  {selectedSku && (
                    <PermissionGuard permissions="inventory_write" mode="hide">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={seedHistoricalData}
                        disabled={isSubmitting}
                        className="whitespace-nowrap"
                      >
                        {isSubmitting ? "Seeding..." : "Seed Training Data"}
                      </Button>
                    </PermissionGuard>
                  )}
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

