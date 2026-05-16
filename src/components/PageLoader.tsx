import React from 'react';
import { Loader2 } from "lucide-react";

export const PageLoader = () => (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            <p className="text-sm text-slate-500 font-medium animate-pulse">
                Đang tải dữ liệu...
            </p>
        </div>
    </div>
);
