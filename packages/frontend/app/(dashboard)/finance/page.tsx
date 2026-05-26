"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, BookOpen, Coins, TrendingUp, Plus, Loader2, ScanText, FileUp, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { financeApi, ocrApi } from "@/lib/api";

type TabType = "accounts" | "journal" | "currencies";

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabType>("accounts");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);

  // Form states
  const [accountForm, setAccountData] = useState({
    code: "",
    name: "",
    type: "ASSET",
    description: "",
  });

  const [journalForm, setJournalData] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: "",
    description: "",
    lines: [
      { accountId: "", debit: 0, credit: 0 },
      { accountId: "", debit: 0, credit: 0 },
    ],
  });

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const result = await ocrApi.parseInvoice(file);
      setJournalData({
        ...journalForm,
        reference: result.invoiceNumber || "",
        description: `OCR Processed: ${result.vendor || "Invoice"}`,
        lines: [
          { accountId: "", debit: result.total || 0, credit: 0 },
          { accountId: "", debit: 0, credit: result.total || 0 },
        ]
      });
      setIsOcrModalOpen(false);
      setIsJournalModalOpen(true);
      toast.success("Invoice scanned successfully!");
    } catch (err: any) {
      toast.error("Scan failed", { description: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  const { data: accountsData, isLoading: accountsLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => financeApi.getAccounts({ limit: 100 }),
  });

  const { data: journalData, isLoading: journalLoading, refetch: refetchJournal } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: () => financeApi.getJournalEntries({ limit: 50 }),
  });

  const { data: currenciesData, isLoading: currenciesLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: () => financeApi.getCurrencies(),
  });

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await financeApi.createAccount(accountForm);
      setIsAccountModalOpen(false);
      setAccountData({ code: "", name: "", type: "ASSET", description: "" });
      refetchAccounts();
    } catch (err: any) {
      toast.error("Failed to create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate double entry
    const totalDebit = journalForm.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = journalForm.lines.reduce((sum, l) => sum + Number(l.credit), 0);
    
    if (totalDebit !== totalCredit) {
      toast.error(`Unbalanced entry! Debit (${totalDebit}) must equal Credit (${totalCredit})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await financeApi.createJournalEntry(journalForm);
      setIsJournalModalOpen(false);
      setJournalData({
        date: new Date().toISOString().split('T')[0],
        reference: "",
        description: "",
        lines: [{ accountId: "", debit: 0, credit: 0 }, { accountId: "", debit: 0, credit: 0 }],
      });
      refetchJournal();
    } catch (err: any) {
      toast.error("Failed to create journal entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: "accounts" as TabType, label: "Accounts", icon: BookOpen },
    { id: "journal" as TabType, label: "Journal Entries", icon: DollarSign },
    { id: "currencies" as TabType, label: "Currencies", icon: Coins },
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
            <label className="text-sm font-semibold">Entry Lines</label>
            {journalForm.lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
                <div className="col-span-6 space-y-1">
                  <label className="text-xs text-gray-500">Account</label>
                  <select
                    required
                    className="w-full px-2 py-1.5 border rounded text-sm"
                    value={line.accountId}
                    onChange={e => {
                      const newLines = [...journalForm.lines];
                      newLines[index].accountId = e.target.value;
                      setJournalData({ ...journalForm, lines: newLines });
                    }}
                  >
                    <option value="">Select Account</option>
                    {accountsData?.data?.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs text-gray-500">Debit</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 border rounded text-sm"
                    value={line.debit}
                    onChange={e => {
                      const newLines = [...journalForm.lines];
                      newLines[index].debit = Number(e.target.value);
                      newLines[index].credit = 0;
                      setJournalData({ ...journalForm, lines: newLines });
                    }}
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs text-gray-500">Credit</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 border rounded text-sm"
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
                lines: [...journalForm.lines, { accountId: "", debit: 0, credit: 0 }]
              })}
            >
              + Add Line
            </Button>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="ghost" type="button" onClick={() => setIsJournalModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Posting..." : "Post Entry"}
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
            <Button onClick={() => setIsAccountModalOpen(true)}>
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
                  ) : (accountsData?.data?.length ?? 0) > 0 ? (
                    accountsData.data.map((account: any) => (
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
                        <td className="px-4 py-3 text-sm font-mono">${Number(account.balance || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm">Edit</Button>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOcrModalOpen(true)}>
              <ScanText className="mr-2 h-4 w-4" />
              Scan Invoice (OCR)
            </Button>
            <Button onClick={() => setIsJournalModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Entry
            </Button>
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
                  ) : (journalData?.data?.length ?? 0) > 0 ? (
                    journalData.data.map((entry: any) => (
                      <React.Fragment key={entry.id}>
                        <tr 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedJournalId(expandedJournalId === entry.id ? null : entry.id)}
                        >
                          <td className="px-4 py-3 text-sm">{entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3 text-sm font-mono">{entry.entryNumber || entry.reference || '-'}</td>
                          <td className="px-4 py-3 text-sm">{entry.description}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono">
                            ${Number(entry.lines?.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0) || 0).toLocaleString()}
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
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Debit</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Credit</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {entry.lines?.map((line: any) => (
                                      <tr key={line.id}>
                                        <td className="px-4 py-2">
                                          <div className="font-medium text-gray-700">{line.account?.name}</div>
                                          <div className="text-xs text-gray-400">{line.account?.code}</div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">
                                          {Number(line.debit) > 0 ? `$${Number(line.debit).toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">
                                          {Number(line.credit) > 0 ? `$${Number(line.credit).toLocaleString()}` : '-'}
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
          <div className="grid gap-4 md:grid-cols-3">
            {currenciesLoading ? (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (currenciesData?.data?.length ?? 0) > 0 ? (
              currenciesData.data.map((currency: any) => (
                <div key={currency.id} className="rounded-lg border bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{currency.code}</p>
                      <p className="text-sm text-muted-foreground">{currency.name}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
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
    </div>
  );
}
