import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { AdminFormSection, AdminFormSurface } from '@/components/layout/AdminFormShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isStepUpRequiredError, referenceOptionsApi } from '@/lib/api';

const DEFAULT_FORM = {
  option_group: '',
  value: '',
  label: '',
  description: '',
  meta_json: '{}',
  sort_order: 100,
  active: true,
};

export function ReferenceOptionEditor({ optionId }: { optionId?: number }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (!optionId) return;
        const option = await referenceOptionsApi.get(optionId);
        setForm({
          option_group: option.option_group,
          value: option.value,
          label: option.label,
          description: option.description,
          meta_json: option.meta_json || '{}',
          sort_order: option.sort_order,
          active: option.active,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể tải reference option');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [optionId]);

  const submit = async () => {
    if (optionId) {
      await referenceOptionsApi.update(optionId, form);
      toast.success('Cập nhật reference option thành công');
    } else {
      await referenceOptionsApi.create(form);
      toast.success('Tạo reference option thành công');
    }
    navigate('/reference-options');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await submit();
    } catch (err) {
      if (isStepUpRequiredError(err)) {
        setPendingAction(() => submit);
        setStepUpOpen(true);
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Lưu reference option thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!pendingAction) return;
          setSaving(true);
          try {
            await pendingAction();
          } finally {
            setPendingAction(null);
            setSaving(false);
          }
        }}
        description="Xác thực lại để tạo hoặc cập nhật reference option."
      />
      <PageHeader
        title={optionId ? 'Cập nhật Reference Option' : 'Tạo Reference Option Mới'}
        subtitle="Quản trị catalog DB-backed cho các dropdown runtime và template mở rộng."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/reference-options')}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu
            </Button>
          </div>
        }
      />

      <AdminFormSurface className="from-white via-amber-50/35 to-sky-50/30">
        <AdminFormSection title="Reference Option Detail" description="Quản trị catalog DB-backed cho dropdown runtime, template metadata và option mở rộng trong tương lai.">
          <div><Label>Option Group</Label><Input value={form.option_group} onChange={(e) => setForm(f => ({ ...f, option_group: e.target.value }))} /></div>
          <div><Label>Value</Label><Input value={form.value} onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))} /></div>
          <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} /></div>
          <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value || 100) }))} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="md:col-span-2">
            <Label>Meta JSON</Label>
            <textarea
              value={form.meta_json}
              onChange={(e) => setForm(f => ({ ...f, meta_json: e.target.value }))}
              className="min-h-56 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
              Active
            </label>
          </div>
        </AdminFormSection>
      </AdminFormSurface>
    </div>
  );
}
