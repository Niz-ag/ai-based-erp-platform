"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, BookOpen, Coins, TrendingUp, Plus, Loader2, ScanText, FileUp, BrainCircuit, BarChart3, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { financeApi, ocrApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

type TabType = "accounts" | "journal" | "currencies" | "reports";

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabType>("accounts");
  const [ledgerFilters, setLedgerFilters] = useState({
    startDate: "",
    endDate: "",
  });
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);

  const [isEditCurrencyModalOpen, setIsEditCurrencyModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<any>(null);

  // Report Date Range State
  const [reportDates, setReportDates] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [bsAsOfDate, setBsAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  // Journal Filter State
  const [journalFilters, setJournalFilters] = useState({
    startDate: "",
    endDate: "",
  });

  // Form states
  const [accountForm, setAccountData] = useState({
    code: "",
    name: "",
    type: "ASSET",
    description: "",
  });

  const [currencyForm, setCurrencyData] = useState({
    code: "",
    name: "",
    exchangeRate: 1,
  });

  const [journalForm, setJournalData] = useState({
    id: "", // For draft entries
    date: new Date().toISOString().split('T')[0],
    reference: "",
    description: "",
    lines: [
      { accountId: "", debit: 0, credit: 0, currencyId: "" },
      { accountId: "", debit: 0, credit: 0, currencyId: "" },
    ],
  });

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const result = await ocrApi.parseInvoice(file);
      // Backend now creates a DRAFT JournalEntry
      setJournalData({
        id: result.journalEntryId || "",
        date: result.date || new Date().toISOString().split('T')[0],
        reference: result.invoiceNumber || "",
        description: `OCR Processed: ${result.vendorName || result.vendor || "Invoice"}`,
        lines: result.lines || [
          { accountId: result.vendorAccountId || "", debit: 0, credit: result.total || 0 },
          { accountId: result.expenseAccountId || "", debit: result.total || 0, credit: 0 },
        ]
      });
      setIsOcrModalOpen(false);
      setIsJournalModalOpen(true);
      toast.success("Invoice scanned and draft entry created!");
    } catch (err: any) {
      toast.error("Scan failed", { description: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  const handlePostEntry = async (id: string) => {
    setIsSubmitting(true);
    try {
      await financeApi.postJournalEntry(id);
      setIsJournalModalOpen(false);
      setJournalData({
        id: "",
        date: new Date().toISOString().split('T')[0],
        reference: "",
        description: "",
        lines: [{ accountId: "", debit: 0, credit: 0, currencyId: "" }, { accountId: "", debit: 0, credit: 0, currencyId: "" }],
      });
      refetchJournal();
      toast.success("Journal entry posted to ledger successfully");
    } catch (err: any) {
      toast.error("Failed to post entry", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { data: accountsData, isLoading: accountsLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => financeApi.getAccounts({ limit: 100 }),
  });

  const { data: journalData, isLoading: journalLoading, refetch: refetchJournal } = useQuery({
    queryKey: ["journal-entries", ledgerFilters.startDate, ledgerFilters.endDate],
    queryFn: () => financeApi.getJournalEntries({ limit: 50, ...ledgerFilters }),
  });

  const { data: currenciesData, isLoading: currenciesLoading, refetch: refetchCurrencies } = useQuery({
    queryKey: ["currencies"],
    queryFn: () => financeApi.getCurrencies(),
  });

  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ["profit-loss", reportDates.startDate, reportDates.endDate],
    queryFn: () => financeApi.getProfitLoss(reportDates),
    enabled: activeTab === "reports",
  });

  const { data: bsData, isLoading: bsLoading } = useQuery({
    queryKey: ["balance-sheet", bsAsOfDate],
    queryFn: () => financeApi.getBalanceSheet({ date: bsAsOfDate }),
    enabled: activeTab === "reports",
  });

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await financeApi.createAccount(accountForm as any);
      setIsAccountModalOpen(false);
      setAccountData({ code: "", name: "", type: "ASSET", description: "" });
      refetchAccounts();
      toast.success("Account created successfully");
    } catch (err: any) {
      toast.error("Failed to create account", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the account "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await financeApi.deleteAccount(id);
      toast.success("Account deleted successfully");
      refetchAccounts();
    } catch (err: any) {
      // Handle the "In-Use" error gracefully as requested
      if (err.message.includes("409") || err.message.toLowerCase().includes("conflict") || err.message.toLowerCase().includes("existing")) {
        toast.error("Cannot delete account", {
          description: "This account has existing journal entries or child accounts and cannot be deleted.",
        });
      } else {
        toast.error("Failed to delete account", {
          description: err.message,
        });
      }
    }
  };

  const handleEditAccount = (account: any) => {
    setEditingAccount(account);
    setAccountData({
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description || "",
    });
    setIsEditAccountModalOpen(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setIsSubmitting(true);
    try {
      await financeApi.updateAccount(editingAccount.id, accountForm as any);
      setIsEditAccountModalOpen(false);
      setEditingAccount(null);
      setAccountData({ code: "", name: "", type: "ASSET", description: "" });
      refetchAccounts();
      toast.success("Account updated successfully");
    } catch (err: any) {
      toast.error("Failed to update account", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCurrency = (currency: any) => {
    setEditingCurrency(currency);
    setCurrencyData({
      code: currency.code,
      name: currency.name,
      exchangeRate: currency.exchangeRate,
    });
    setIsEditCurrencyModalOpen(true);
  };

  const handleUpdateCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurrency) return;
    setIsSubmitting(true);
    try {
      await financeApi.updateCurrency(editingCurrency.id, currencyForm);
      setIsEditCurrencyModalOpen(false);
      setEditingCurrency(null);
      refetchCurrencies();
      toast.success("Currency updated successfully");
    } catch (err: any) {
      toast.error("Failed to update currency", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCurrency = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete the currency "${code}"?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await financeApi.deleteCurrency(id);
      toast.success("Currency deleted successfully");
      refetchCurrencies();
    } catch (err: any) {
      toast.error("Failed to delete currency", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (!plData || !bsData) {
      toast.error("No data available to export");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    const wrap = (val: any) => `"${val}"`;
    
    // P&L Section
    csvContent += wrap("PROFIT & LOSS STATEMENT") + "\n";
    csvContent += `${wrap("Period")},${wrap(reportDates.startDate + " to " + reportDates.endDate)}\n\n`;
    csvContent += `${wrap("Category")},${wrap("Name")},${wrap("Balance")}\n`;
    
    plData.revenue?.forEach((item: any) => {
      csvContent += `${wrap("Revenue")},${wrap(item.name)},${wrap(item.balance)}\n`;
    });
    csvContent += `${wrap("TOTAL REVENUE")},${wrap("")},${wrap(plData.totalRevenue)}\n\n`;
    
    plData.expense?.forEach((item: any) => {
      csvContent += `${wrap("Expense")},${wrap(item.name)},${wrap(item.balance)}\n`;
    });
    csvContent += `${wrap("TOTAL EXPENSES")},${wrap("")},${wrap(plData.totalExpense)}\n\n`;
    csvContent += `${wrap("NET PROFIT")},${wrap("")},${wrap(plData.netProfit)}\n\n\n`;

    // Balance Sheet Section
    csvContent += wrap("BALANCE SHEET") + "\n";
    csvContent += `${wrap("As of")},${wrap(bsAsOfDate)}\n\n`;
    csvContent += `${wrap("Category")},${wrap("Name")},${wrap("Balance")}\n`;
    
    bsData.assets?.forEach((item: any) => {
      csvContent += `${wrap("Asset")},${wrap(item.name)},${wrap(item.balance)}\n`;
    });
    csvContent += `${wrap("TOTAL ASSETS")},${wrap("")},${wrap(bsData.totalAssets)}\n\n`;
    
    bsData.liabilities?.forEach((item: any) => {
      csvContent += `${wrap("Liability")},${wrap(item.name)},${wrap(item.balance)}\n`;
    });
    csvContent += `${wrap("TOTAL LIABILITIES")},${wrap("")},${wrap(bsData.totalLiabilities)}\n\n`;
    
    bsData.equity?.forEach((item: any) => {
      csvContent += `${wrap("Equity")},${wrap(item.name)},${wrap(item.balance)}\n`;
    });
    csvContent += `${wrap("TOTAL EQUITY")},${wrap("")},${wrap(bsData.totalEquity)}\n`;

    const totalLiabilitiesEquity = Number(bsData.totalLiabilities) + Number(bsData.totalEquity);
    csvContent += `${wrap("TOTAL LIABILITIES + EQUITY")},${wrap("")},${wrap(totalLiabilitiesEquity)}\n`;
    
    const isBalanced = Math.abs(Number(bsData.totalAssets) - totalLiabilitiesEquity) < 0.01;
    csvContent += `${wrap("Status")},${wrap("")},${wrap(isBalanced ? "Balanced" : "Unbalanced")}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV Export started");
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate double entry (only if all lines are same currency)
    const totalDebit = journalForm.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = journalForm.lines.reduce((sum, l) => sum + Number(l.credit), 0);
    const allUsd = journalForm.lines.every(l => !l.currencyId);
    const sameOtherCurrency = journalForm.lines.every(l => l.currencyId === journalForm.lines[0].currencyId);
    
    if ((allUsd || sameOtherCurrency) && totalDebit !== totalCredit) {
      toast.error(`Unbalanced entry! Debit (${totalDebit}) must equal Credit (${totalCredit})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await financeApi.createJournalEntry(journalForm);
      setIsJournalModalOpen(false);
      setJournalData({
        id: "",
        date: new Date().toISOString().split('T')[0],
        reference: "",
        description: "",
        lines: [{ accountId: "", debit: 0, credit: 0, currencyId: "" }, { accountId: "", debit: 0, credit: 0, currencyId: "" }],
      });
      refetchJournal();
    } catch (err: any) {
      toast.error("Failed to create journal entry", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await financeApi.createCurrency(currencyForm);
      setIsCurrencyModalOpen(false);
      setCurrencyData({ code: "", name: "", exchangeRate: 1 });
      refetchCurrencies();
      toast.success("Currency created successfully");
    } catch (err: any) {
      toast.error("Failed to create currency", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddAccount = () => {
    setAccountData({ code: "", name: "", type: "ASSET", description: "" });
    setIsAccountModalOpen(true);
  };

  const handleOpenAddCurrency = () => {
    setCurrencyData({ code: "", name: "", exchangeRate: 1 });
    setIsCurrencyModalOpen(true);
  };

  const tabs = [
    { id: "accounts" as TabType, label: "Accounts", icon: BookOpen },
    { id: "journal" as TabType, label: "Journal Entries", icon: DollarSign },
    { id: "currencies" as TabType, label: "Currencies", icon: Coins },
    { id: "reports" as TabType, label: "Reports", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">
          Manage accounts, journal entries, and currencies
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
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Add New Account"
      >
        <form onSubmit={handleAddAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account Code</label>
              <input
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={accountForm.code}
                onChange={e => setAccountData({ ...accountForm, code: e.target.value })}
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Account Type</label>
              <select
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={accountForm.type}
                onChange={e => setAccountData({ ...accountForm, type: e.target.value })}
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Account Name</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={accountForm.name}
              onChange={e => setAccountData({ ...accountForm, name: e.target.value })}
              placeholder="Cash in Bank"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={accountForm.description}
              onChange={e => setAccountData({ ...accountForm, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        title="Add New Currency"
      >
        <form onSubmit={handleAddCurrency} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency Code</label>
              <input
                required
                maxLength={3}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                placeholder="EUR"
                value={currencyForm.code}
                onChange={e => setCurrencyData({ ...currencyForm, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency Name</label>
              <input
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Euro"
                value={currencyForm.name}
                onChange={e => setCurrencyData({ ...currencyForm, name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Exchange Rate (to Base)</label>
            <input
              type="number"
              step="0.0001"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currencyForm.exchangeRate}
              onChange={e => setCurrencyData({ ...currencyForm, exchangeRate: Number(e.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsCurrencyModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Currency"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        title="New Journal Entry"
      >
        <form onSubmit={handleAddJournal} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={journalForm.date}
                onChange={e => setJournalData({ ...journalForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference</label>
              <input
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={journalForm.reference}
                onChange={e => setJournalData({ ...journalForm, reference: e.target.value })}
                placeholder="INV-001"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={journalForm.description}
              onChange={e => setJournalData({ ...journalForm, description: e.target.value })}
              placeholder="Office supplies purchase"
            />
          </div>

          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold">Entry Lines</label>
              <div className="text-xs font-medium px-2 py-1 rounded bg-gray-100">
                Balance: 
                <span className={`ml-1 ${(journalForm.lines.reduce((sum, l) => sum + Number(l.debit), 0) - journalForm.lines.reduce((sum, l) => sum + Number(l.credit), 0)) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${(journalForm.lines.reduce((sum, l) => sum + Number(l.debit), 0) - journalForm.lines.reduce((sum, l) => sum + Number(l.credit), 0)).toFixed(2)}
                </span>
              </div>
            </div>
            {journalForm.lines.map((line, index) => (
              <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2 items-start md:items-end border-b pb-4 md:pb-3">
                <div className="w-full md:col-span-4 space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Account</label>
                  <select
                    required
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                    value={line.accountId}
                    onChange={e => {
                      const newLines = [...journalForm.lines];
                      newLines[index].accountId = e.target.value;
                      setJournalData({ ...journalForm, lines: newLines });
                    }}
                  >
                    <option value="">Select Account</option>
                    {accountsData?.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:col-span-2 space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Curr</label>
                  <select
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                    value={line.currencyId}
                    onChange={e => {
                      const newLines = [...journalForm.lines];
                      newLines[index].currencyId = e.target.value;
                      setJournalData({ ...journalForm, lines: newLines });
                    }}
                  >
                    <option value="">USD</option>
                    {currenciesData?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:col-span-3 space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Debit</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                    value={line.debit}
                    onChange={e => {
                      const newLines = [...journalForm.lines];
                      newLines[index].debit = Number(e.target.value);
                      newLines[index].credit = 0;
                      setJournalData({ ...journalForm, lines: newLines });
                    }}
                  />
                </div>
                <div className="w-full md:col-span-3 space-y-1">
                  <label className="text-xs text-gray-500 font-medium text-right w-full block md:inline">Credit</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                    value={line.credit}
                    onChange={e => {
                      const newLines = [...journalForm.lines];
                      newLines[index].credit = Number(e.target.value);
                      newLines[index].debit = 0;
                      setJournalData({ ...journalForm, lines: newLines });
                    }}
                  />
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setJournalData({
                ...journalForm,
                lines: [...journalForm.lines, { accountId: "", debit: 0, credit: 0, currencyId: "" }]
              })}
            >
              + Add Line
            </Button>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="ghost" type="button" onClick={() => setIsJournalModalOpen(false)}>
              Cancel
            </Button>
            {journalForm.id ? (
              <Button 
                type="button" 
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handlePostEntry(journalForm.id)}
                disabled={isSubmitting || (journalForm.lines.reduce((sum, l) => sum + Number(l.debit), 0) - journalForm.lines.reduce((sum, l) => sum + Number(l.credit), 0)) !== 0}
              >
                {isSubmitting ? "Posting..." : "Confirm & Post to Ledger"}
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isSubmitting || (journalForm.lines.reduce((sum, l) => sum + Number(l.debit), 0) - journalForm.lines.reduce((sum, l) => sum + Number(l.credit), 0)) !== 0}
              >
                {isSubmitting ? "Posting..." : "Post Entry"}
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditAccountModalOpen}
        onClose={() => setIsEditAccountModalOpen(false)}
        title="Edit Account"
      >
        <form onSubmit={handleUpdateAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account Code</label>
              <input
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={accountForm.code}
                onChange={e => setAccountData({ ...accountForm, code: e.target.value })}
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Account Type</label>
              <select
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={accountForm.type}
                onChange={e => setAccountData({ ...accountForm, type: e.target.value })}
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Account Name</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={accountForm.name}
              onChange={e => setAccountData({ ...accountForm, name: e.target.value })}
              placeholder="Cash in Bank"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={accountForm.description}
              onChange={e => setAccountData({ ...accountForm, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsEditAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Account"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditCurrencyModalOpen}
        onClose={() => setIsEditCurrencyModalOpen(false)}
        title="Edit Currency"
      >
        <form onSubmit={handleUpdateCurrency} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Currency Code</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currencyForm.code}
              onChange={e => setCurrencyData({ ...currencyForm, code: e.target.value })}
              placeholder="EUR"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Currency Name</label>
            <input
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currencyForm.name}
              onChange={e => setCurrencyData({ ...currencyForm, name: e.target.value })}
              placeholder="Euro"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Exchange Rate (to Base)</label>
            <input
              type="number"
              step="0.0001"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currencyForm.exchangeRate}
              onChange={e => setCurrencyData({ ...currencyForm, exchangeRate: Number(e.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsEditCurrencyModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Currency"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isOcrModalOpen} onClose={() => setIsOcrModalOpen(false)} title="AI Invoice Scanning (OCR)">
        <div className="space-y-6 py-4">
          <div className="relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 transition-colors hover:bg-gray-50">
            <FileUp className="h-12 w-12 text-blue-500 mb-4" />
            <div className="text-center">
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG (Max 5MB)</p>
            </div>
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
              onChange={handleOcrUpload}
              disabled={isScanning}
            />
          </div>

          {isScanning && (
            <div className="flex items-center justify-center gap-3 text-blue-600 bg-blue-50 p-4 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm font-medium">AI is analyzing invoice data...</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" />
              Smart Match Technology
            </h4>
            <p className="text-xs text-amber-700 mt-1">
              Our AI automatically detects vendors, tax amounts, and line items. Review the results before posting to the ledger.
            </p>
          </div>
        </div>
      </Modal>

      {/* Accounts Tab Content */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleOpenAddAccount}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
          
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Balance</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accountsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : (accountsData?.length ?? 0) > 0 ? (
                    accountsData?.map((account: any) => (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                        <td className="px-4 py-3 text-sm font-medium">{account.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            account.type === 'ASSET' ? 'bg-blue-100 text-blue-700' :
                            account.type === 'LIABILITY' ? 'bg-red-100 text-red-700' :
                            account.type === 'EQUITY' ? 'bg-purple-100 text-purple-700' :
                            account.type === 'REVENUE' ? 'bg-green-100 text-green-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {account.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{formatCurrency(Number(account.balance || 0))}</td>
                        <td className="px-4 py-3 text-right flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditAccount(account)}>Edit</Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteAccount(account.id, account.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Journal Entries Tab Content */}
      {activeTab === "journal" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex gap-4 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">From Date</label>
                <input 
                  type="date" 
                  className="block w-full px-3 py-1.5 border rounded-md text-sm"
                  value={ledgerFilters.startDate}
                  onChange={(e) => setLedgerFilters({ ...ledgerFilters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">To Date</label>
                <input 
                  type="date" 
                  className="block w-full px-3 py-1.5 border rounded-md text-sm"
                  value={ledgerFilters.endDate}
                  onChange={(e) => setLedgerFilters({ ...ledgerFilters, endDate: e.target.value })}
                />
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLedgerFilters({ startDate: "", endDate: "" })}
                className="text-gray-500"
              >
                Clear
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOcrModalOpen(true)}>
                <ScanText className="mr-2 h-4 w-4" />
                Scan Invoice (OCR)
              </Button>
              <Button onClick={() => setIsJournalModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-white shadow-sm overflow-hidden">

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reference</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {journalLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : (journalData?.length ?? 0) > 0 ? (
                    journalData?.map((entry: any) => (
                      <React.Fragment key={entry.id}>
                        <tr 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedJournalId(expandedJournalId === entry.id ? null : entry.id)}
                        >
                          <td className="px-4 py-3 text-sm">{entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3 text-sm font-mono">{entry.entryNumber || entry.reference || '-'}</td>
                          <td className="px-4 py-3 text-sm">{entry.description}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono">
                            {formatCurrency(Number(entry.lines?.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0) || 0))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              entry.status === 'POSTED' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {entry.status || 'DRAFT'}
                            </span>
                          </td>
                        </tr>
                        {expandedJournalId === entry.id && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={5} className="px-8 py-4">
                              <div className="border rounded-md bg-white overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Account</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Debit (Orig)</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Credit (Orig)</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase text-blue-600">Debit (USD)</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase text-blue-600">Credit (USD)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {entry.lines?.map((line: any) => (
                                      <tr key={line.id}>
                                        <td className="px-4 py-2">
                                          <div className="font-medium text-gray-700">{line.account?.name}</div>
                                          <div className="text-xs text-gray-400">
                                            {line.account?.code} {line.currency ? `(${line.currency.code})` : '(USD)'}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">
                                          {Number(line.debit) > 0 ? formatCurrency(Number(line.debit), line.currency?.code) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">
                                          {Number(line.credit) > 0 ? formatCurrency(Number(line.credit), line.currency?.code) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-blue-600">
                                          {Number(line.baseDebit) > 0 ? formatCurrency(Number(line.baseDebit)) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-blue-600">
                                          {Number(line.baseCredit) > 0 ? formatCurrency(Number(line.baseCredit)) : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No journal entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Currencies Tab Content */}
      {activeTab === "currencies" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleOpenAddCurrency}>
              <Plus className="mr-2 h-4 w-4" />
              Add Currency
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {currenciesLoading ? (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (currenciesData?.length ?? 0) > 0 ? (
              currenciesData?.map((currency: any) => (
                <div key={currency.id} className="rounded-lg border bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{currency.code}</p>
                      <p className="text-sm text-muted-foreground">{currency.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditCurrency(currency)}>
                          <Plus className="h-4 w-4 rotate-45" /> {/* Use Plus rotated for now or find Edit icon */}
                        </Button>
                        {!currency.isBase && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-red-600" 
                            onClick={() => handleDeleteCurrency(currency.id, currency.code)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex justify-between">
                    <span>Rate: {Number(currency.exchangeRate || 1).toFixed(4)}</span>
                    {currency.isBase && <span className="text-blue-600 font-bold uppercase">Base</span>}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                No currencies found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab Content */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-6 bg-white p-4 rounded-lg border shadow-sm">
            <div className="space-y-4 flex-1">
              <h4 className="text-sm font-semibold text-gray-700">P&L Date Range</h4>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Start Date
                  </label>
                  <input
                    type="date"
                    className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={reportDates.startDate}
                    onChange={e => setReportDates({ ...reportDates, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> End Date
                  </label>
                  <input
                    type="date"
                    className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={reportDates.endDate}
                    onChange={e => setReportDates({ ...reportDates, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border-l pl-6">
              <h4 className="text-sm font-semibold text-gray-700">Balance Sheet "As Of"</h4>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Report Date
                </label>
                <input
                  type="date"
                  className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={bsAsOfDate}
                  onChange={e => setBsAsOfDate(e.target.value)}
                />
              </div>
            </div>

            <Button variant="outline" onClick={handleExportCSV} className="ml-auto">
              Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit & Loss Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Profit & Loss
              </h3>
              {plLoading ? (
                <div className="py-12 text-center bg-white border rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                  <p className="mt-2 text-muted-foreground text-sm">Calculating P&L...</p>
                </div>
              ) : plData ? (
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-gray-50 border-b px-4 py-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-center">Profit & Loss Statement</h3>
                    <p className="text-[10px] text-muted-foreground text-center">
                      {new Date(reportDates.startDate).toLocaleDateString()} to {new Date(reportDates.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="p-4 space-y-6">
                    <section>
                      <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-2 border-b pb-1">Revenue</h4>
                      <table className="w-full text-sm">
                        <tbody className="divide-y">
                          {plData.revenue?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-1.5">{item.name}</td>
                              <td className="py-1.5 text-right font-mono">{formatCurrency(Number(item.balance))}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total Revenue</td>
                            <td className="py-2 text-right font-mono text-green-700">{formatCurrency(Number(plData.totalRevenue))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    <section>
                      <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-2 border-b pb-1">Expenses</h4>
                      <table className="w-full text-sm">
                        <tbody className="divide-y">
                          {plData.expense?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-1.5">{item.name}</td>
                              <td className="py-1.5 text-right font-mono">{formatCurrency(Number(item.balance))}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total Expenses</td>
                            <td className="py-2 text-right font-mono text-red-700">{formatCurrency(Number(plData.totalExpense))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    <div className="pt-2 border-t-2 border-double">
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
                        <span className="font-bold">Net Profit</span>
                        <span className={`font-bold font-mono ${Number(plData.netProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Number(plData.netProfit))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Balance Sheet Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Balance Sheet
              </h3>
              {bsLoading ? (
                <div className="py-12 text-center bg-white border rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" />
                  <p className="mt-2 text-muted-foreground text-sm">Generating Balance Sheet...</p>
                </div>
              ) : bsData ? (
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-gray-50 border-b px-4 py-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-center">Balance Sheet</h3>
                    <p className="text-[10px] text-muted-foreground text-center">
                      As of {new Date(bsAsOfDate).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="p-4 space-y-6">
                    {/* Assets */}
                    <section>
                      <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-2 border-b pb-1">Assets</h4>
                      <table className="w-full text-sm">
                        <tbody className="divide-y">
                          {bsData.assets?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-1.5">{item.name}</td>
                              <td className="py-1.5 text-right font-mono">{formatCurrency(Number(item.balance))}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total Assets</td>
                            <td className="py-2 text-right font-mono text-blue-700">{formatCurrency(Number(bsData.totalAssets))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    {/* Liabilities */}
                    <section>
                      <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-2 border-b pb-1">Liabilities</h4>
                      <table className="w-full text-sm">
                        <tbody className="divide-y">
                          {bsData.liabilities?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-1.5">{item.name}</td>
                              <td className="py-1.5 text-right font-mono">{formatCurrency(Number(item.balance))}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total Liabilities</td>
                            <td className="py-2 text-right font-mono text-red-700">{formatCurrency(Number(bsData.totalLiabilities))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    {/* Equity */}
                    <section>
                      <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-2 border-b pb-1">Equity</h4>
                      <table className="w-full text-sm">
                        <tbody className="divide-y">
                          {bsData.equity?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-1.5">{item.name}</td>
                              <td className="py-1.5 text-right font-mono">{formatCurrency(Number(item.balance))}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total Equity</td>
                            <td className="py-2 text-right font-mono text-purple-700">{formatCurrency(Number(bsData.totalEquity))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    {/* Verification */}
                    <div className="pt-2 border-t-2 border-double">
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
                        <span className="font-bold text-xs uppercase">Liabilities + Equity</span>
                        <span className="font-bold font-mono text-green-600">
                          {formatCurrency(Number(bsData.totalLiabilities) + Number(bsData.totalEquity))}
                        </span>
                      </div>
                      <div className="mt-1 text-center">
                        {(Math.abs(Number(bsData.totalAssets) - (Number(bsData.totalLiabilities) + Number(bsData.totalEquity))) < 0.01) ? (
                          <span className="text-[10px] text-green-600 font-medium">✓ Equation Balanced: Assets = Liabilities + Equity</span>
                        ) : (
                          <span className="text-[10px] text-red-600 font-medium">⚠ Equation Unbalanced</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
