'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function BankReconciliationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualEntryForm, setManualEntryForm] = useState({
    bankAccountId: '',
    otherAccountId: '',
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => financeApi.getAccounts({ limit: 100 }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const data = await financeApi.processBankStatement(file);
      setResults(data);
      toast.success('Statement processed successfully');
    } catch (error) {
      console.error('Failed to process bank statement', error);
      toast.error('Error processing file. Please ensure it is a valid CSV.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenManualEntry = (line: any) => {
    setSelectedLine(line);
    // Try to pre-select a bank account (ASSET)
    const bankAcc = accountsData?.find((a: any) => a.type === 'ASSET' && a.name.toLowerCase().includes('bank'));
    setManualEntryForm({
      bankAccountId: bankAcc?.id || '',
      otherAccountId: '',
    });
    setIsManualModalOpen(true);
  };

  const handleCreateManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLine || !manualEntryForm.bankAccountId || !manualEntryForm.otherAccountId) {
      toast.error('Please select both accounts');
      return;
    }

    setIsSubmitting(true);
    try {
      await financeApi.createManualBankEntry({
        statementLine: selectedLine,
        bankAccountId: manualEntryForm.bankAccountId,
        otherAccountId: manualEntryForm.otherAccountId,
      });
      
      toast.success('Manual entry created and reconciled');
      setIsManualModalOpen(false);
      
      // Update results to show it's now matched
      setResults(prev => prev.map(r => {
        if (r.statementLine === selectedLine) {
          return {
            ...r,
            matchedEntries: [{ 
              id: 'manual', 
              entryNumber: 'MANUAL', 
              description: selectedLine.description,
              date: selectedLine.date,
              lines: [] // Simplified for UI
            }]
          };
        }
        return r;
      }));
    } catch (err: any) {
      toast.error('Failed to create manual entry', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReconcile = async (journalEntryId: string, statementLine: any) => {
    try {
      await financeApi.reconcile(journalEntryId, statementLine);
      toast.success('Reconciled successfully');
      
      // Update results
      setResults(prev => prev.map(r => {
        if (r.statementLine === statementLine) {
          return {
            ...r,
            matchedEntries: r.matchedEntries.filter((e: any) => e.id === journalEntryId)
          };
        }
        return r;
      }));
    } catch (err: any) {
      toast.error('Failed to reconcile', { description: err.message });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Upload Bank Statement (CSV)</label>
            <Input type="file" accept=".csv" onChange={handleFileChange} />
          </div>
          <Button 
            onClick={handleUpload} 
            disabled={!file || loading}
            className="w-full md:w-auto"
          >
            {loading ? 'Processing...' : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Process Statement
              </>
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Expected CSV columns: Date, Description, Amount
        </p>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Reconciliation Results</h2>
            <div className="text-sm text-gray-500">
              Found {results.length} lines in statement
            </div>
          </div>
          
          <div className="space-y-4">
            {results.map((result, idx) => (
              <div key={idx} className="flex flex-col md:flex-row border rounded-lg overflow-hidden bg-white shadow-sm min-h-[120px]">
                {/* Statement Side */}
                <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r bg-gray-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Statement Line</span>
                    <Badge variant={result.matchedEntries.length > 0 ? "default" : "outline"}>
                      {result.matchedEntries.length > 0 ? 'Auto-matched' : 'Unmatched'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-base leading-tight">{result.statementLine.description}</p>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-sm text-gray-500">{result.statementLine.date}</span>
                      <span className={`font-mono font-bold text-lg ${result.statementLine.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {result.statementLine.amount < 0 ? '' : '+'}{Number(result.statementLine.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ledger Side */}
                <div className="w-full md:w-1/2 p-4 flex flex-col justify-center bg-white">
                  <div className="mb-2">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Ledger Entry</span>
                  </div>
                  {result.matchedEntries.length > 0 ? (
                    <div className="space-y-2">
                      {result.matchedEntries.map((entry: any) => (
                        <div key={entry.id} className="p-2 border rounded-md bg-blue-50/50 border-blue-100">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{entry.entryNumber} - {entry.description}</p>
                              <p className="text-[10px] text-gray-500">{new Date(entry.date).toLocaleDateString()}</p>
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleReconcile(entry.id, result.statementLine)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Reconcile
                            </Button>
                          </div>
                          {entry.lines && entry.lines.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-blue-100/50 space-y-1">
                              {entry.lines
                                .filter((l: any) => 
                                  Math.abs(Number(l.debit || 0)) === Math.abs(result.statementLine.amount) || 
                                  Math.abs(Number(l.credit || 0)) === Math.abs(result.statementLine.amount)
                                )
                                .map((line: any, lidx: number) => (
                                  <div key={lidx} className="flex justify-between text-[11px] font-mono">
                                    <span className="truncate mr-2">{line.account.name}</span>
                                    <span className="font-bold">{Number(line.debit || line.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </div>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 py-2">
                      <AlertCircle className="w-6 h-6 mb-1 opacity-20" />
                      <p className="text-xs italic">No matching journal entry found</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 h-7 text-[10px]"
                        onClick={() => handleOpenManualEntry(result.statementLine)}
                      >
                        Create Manual Entry
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Create Manual Entry"
      >
        <form onSubmit={handleCreateManualEntry} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-md border text-sm">
            <div className="flex justify-between font-medium">
              <span>{selectedLine?.description}</span>
              <span className={selectedLine?.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                ${Math.abs(selectedLine?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{selectedLine?.date}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bank Account</label>
            <select
              required
              className="w-full px-3 py-2 border rounded-md"
              value={manualEntryForm.bankAccountId}
              onChange={e => setManualEntryForm({ ...manualEntryForm, bankAccountId: e.target.value })}
            >
              <option value="">Select Bank Account</option>
              {accountsData?.filter((a: any) => a.type === 'ASSET').map((a: any) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Off-set Account (Revenue/Expense/etc.)</label>
            <select
              required
              className="w-full px-3 py-2 border rounded-md"
              value={manualEntryForm.otherAccountId}
              onChange={e => setManualEntryForm({ ...manualEntryForm, otherAccountId: e.target.value })}
            >
              <option value="">Select Account</option>
              {accountsData?.map((a: any) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" type="button" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create & Reconcile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
