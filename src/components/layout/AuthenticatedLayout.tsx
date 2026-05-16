import React from 'react';
import { Outlet } from "react-router-dom";
import ProtectedRoute from "@/guards/ProtectedRoute";
import { AdminLayout } from "./AdminLayout";

export const AuthenticatedLayout = () => (
    <ProtectedRoute>
        <AdminLayout>
            <Outlet />
        </AdminLayout>
    </ProtectedRoute>
);
