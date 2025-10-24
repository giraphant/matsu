'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getDexAccounts,
  createDexAccount,
  updateDexAccount,
  deleteDexAccount,
} from '@/lib/api';
import type { DexAccount } from '@/lib/api';
import { Trash2, Edit, Plus } from 'lucide-react';

export default function DexAccountsManager() {
  const [accounts, setAccounts] = useState<DexAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DexAccount | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formExchange, setFormExchange] = useState('lighter');
  const [formAddress, setFormAddress] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [formTags, setFormTags] = useState('');
  const [saving, setSaving] = useState(false);

  const availableExchanges = ['lighter', 'hyperliquid', 'vertex', 'aevo', 'dydx'];

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDexAccounts();
      setAccounts(data);
    } catch (err) {
      setError('Failed to fetch DEX accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingAccount(null);
    setFormName('');
    setFormExchange('lighter');
    setFormAddress('');
    setFormEnabled(true);
    setFormNotes('');
    setFormTags('');
    setIsDialogOpen(true);
  }

  function openEditDialog(account: DexAccount) {
    setEditingAccount(account);
    setFormName(account.name);
    setFormExchange(account.exchange);
    setFormAddress(account.address);
    setFormEnabled(account.enabled);
    setFormNotes(account.notes || '');
    setFormTags(account.tags?.join(', ') || '');
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formName || !formExchange || !formAddress) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const tags = formTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const accountData = {
        name: formName,
        exchange: formExchange,
        address: formAddress,
        enabled: formEnabled,
        notes: formNotes || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };

      if (editingAccount) {
        await updateDexAccount(editingAccount.id, accountData);
        setSuccessMessage('Account updated successfully');
      } else {
        await createDexAccount(accountData);
        setSuccessMessage('Account created successfully');
      }

      setIsDialogOpen(false);
      await fetchAccounts();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(editingAccount ? 'Failed to update account' : 'Failed to create account');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete account "${name}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteDexAccount(id);
      setSuccessMessage('Account deleted successfully');
      await fetchAccounts();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to delete account');
      console.error(err);
    }
  }

  async function toggleEnabled(account: DexAccount) {
    try {
      setError(null);
      await updateDexAccount(account.id, { enabled: !account.enabled });
      await fetchAccounts();
    } catch (err) {
      setError('Failed to update account status');
      console.error(err);
    }
  }

  if (loading) {
    return <div>Loading accounts...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">DEX Accounts</h3>
          <p className="text-sm text-gray-500">Manage blockchain accounts for monitoring positions</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No accounts configured. Click "Add Account" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <Badge variant={account.enabled ? "default" : "secondary"}>
                      {account.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Badge variant="outline">{account.exchange}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Switch
                      checked={account.enabled}
                      onCheckedChange={() => toggleEnabled(account)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(account)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(account.id, account.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="font-mono text-xs">
                  {account.address}
                </CardDescription>
              </CardHeader>
              {(account.notes || account.tags) && (
                <CardContent className="pt-0">
                  {account.notes && (
                    <p className="text-sm text-gray-600 mb-2">{account.notes}</p>
                  )}
                  {account.tags && account.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {account.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Update account details'
                : 'Add a new blockchain account to monitor'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="My Trading Account"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exchange">Exchange *</Label>
              <Select value={formExchange} onValueChange={setFormExchange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableExchanges.map((ex) => (
                    <SelectItem key={ex} value={ex}>
                      {ex.charAt(0).toUpperCase() + ex.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address / Account ID *</Label>
              <Input
                id="address"
                placeholder="0x... or account index"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Enter blockchain address or account identifier
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="trading, mainnet, high-priority"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Comma-separated tags for organizing accounts
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes about this account"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formEnabled}
                onCheckedChange={setFormEnabled}
              />
              <Label htmlFor="enabled">Enable monitoring</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (editingAccount ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
