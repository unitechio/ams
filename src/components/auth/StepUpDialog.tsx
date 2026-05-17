import React, { useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, setStepUpToken } from '@/lib/api';

interface StepUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => Promise<void> | void;
  title?: string;
  description?: string;
}

export function StepUpDialog({
  open,
  onOpenChange,
  onVerified,
  title = 'Xác thực lại phiên làm việc',
  description = 'Nhập mật khẩu hiện tại và OTP nếu tài khoản yêu cầu để tiếp tục thao tác nhạy cảm.',
}: StepUpDialogProps) {
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setPassword('');
    setOtp('');
    setNeedsOtp(false);
    setSaving(false);
    setError('');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const resp = await authApi.stepUp(password, otp || undefined);
      setStepUpToken(resp.step_up_token, resp.expires_at);
      await onVerified();
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xác thực thất bại';
      if (msg.toLowerCase().includes('otp')) {
        setNeedsOtp(true);
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mật khẩu hiện tại</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu của bạn"
            />
          </div>

          {needsOtp && (
            <div className="space-y-1.5">
              <Label>Mã OTP</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !password || (needsOtp && otp.length !== 6)}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
