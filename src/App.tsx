import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { AppProvider } from "./context/AppProvider";
import { AuthProvider } from "./context/AuthProvider";
import { ToastProvider } from "./context/ToastProvider";
import { AccountsPage } from "./pages/AccountsPage";
import { BookingRequestsPage } from "./pages/BookingRequestsPage";
import { CheckInPage } from "./pages/CheckInPage";
import { CompliancePage } from "./pages/CompliancePage";
import { CounterPage } from "./pages/CounterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { GuestAppPage } from "./pages/GuestAppPage";
import { HousekeepingPage } from "./pages/HousekeepingPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { LoginPage } from "./pages/LoginPage";
import { MenuPage } from "./pages/MenuPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { QrCardsPage } from "./pages/QrCardsPage";
import { RoomsPage } from "./pages/RoomsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UserManagementPage } from "./pages/UserManagementPage";

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="check-in" element={<CheckInPage />} />
                <Route path="booking-requests" element={<BookingRequestsPage />} />
                <Route path="housekeeping" element={<HousekeepingPage />} />
                <Route path="compliance" element={<CompliancePage />} />
                <Route path="qr-cards" element={<QrCardsPage />} />
                <Route path="counter" element={<CounterPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="menu" element={<MenuPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="guest-app" element={<GuestAppPage />} />
                <Route path="user-management" element={<UserManagementPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </AppProvider>
  );
}
