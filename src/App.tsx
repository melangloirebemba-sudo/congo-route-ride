import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import ClientOnlyRoute from "@/components/ClientOnlyRoute";
import Index from "./pages/Index";
import SearchResults from "./pages/SearchResults";
import TripDetails from "./pages/TripDetails";
import BookingPage from "./pages/BookingPage";
import BookingHistory from "./pages/BookingHistory";
import MyReservations from "./pages/MyReservations";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Preferences from "./pages/Preferences";
import Agencies from "./pages/Agencies";
import AgencyDetail from "./pages/AgencyDetail";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AgenciesAdmin from "./pages/admin/AgenciesAdmin";
import AgencyBookingsAdmin from "./pages/admin/AgencyBookingsAdmin";
import TransactionsAdmin from "./pages/admin/TransactionsAdmin";
import UsersAdmin from "./pages/admin/UsersAdmin";
import AuditLogAdmin from "./pages/admin/AuditLogAdmin";
import StatsAdmin from "./pages/admin/StatsAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import ScanAdmin from "./pages/admin/ScanAdmin";
import DistrictsAdmin from "./pages/admin/DistrictsAdmin";
import AgencyLayout from "./pages/agency/AgencyLayout";
import AgencyDashboard from "./pages/agency/AgencyDashboard";
import AgencyTrips from "./pages/agency/AgencyTrips";
import AgencyBookings from "./pages/agency/AgencyBookings";
import AgencyBranches from "./pages/agency/AgencyBranches";
import AgencySubAgencies from "./pages/agency/AgencySubAgencies";
import AgencyManagers from "./pages/agency/AgencyManagers";
import AgencySettings from "./pages/agency/AgencySettings";
import AgencyAudit from "./pages/agency/AgencyAudit";
import AgencyBroadcast from "./pages/agency/AgencyBroadcast";
import AgencyReports from "./pages/agency/AgencyReports";
import ManagerReport from "./pages/manager/ManagerReport";

import ManagerLayout from "./pages/manager/ManagerLayout";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import ManagerTrips from "./pages/manager/ManagerTrips";
import ManagerBookings from "./pages/manager/ManagerBookings";
import ManagerSale from "./pages/manager/ManagerSale";
import ManagerNotifications from "./pages/manager/ManagerNotifications";
import ManagerBoarding from "./pages/manager/ManagerBoarding";

import AgencyCounterSale from "./pages/agency/AgencyCounterSale";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/search" element={<ClientOnlyRoute><SearchResults /></ClientOnlyRoute>} />
            <Route path="/trip/:id" element={<ClientOnlyRoute><TripDetails /></ClientOnlyRoute>} />
            <Route path="/booking/:id" element={<ClientOnlyRoute><BookingPage /></ClientOnlyRoute>} />
            <Route path="/bookings" element={<ClientOnlyRoute><BookingHistory /></ClientOnlyRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/agencies" element={<ClientOnlyRoute><Agencies /></ClientOnlyRoute>} />
            <Route path="/agencies/:id" element={<ClientOnlyRoute><AgencyDetail /></ClientOnlyRoute>} />
            
            
            {/* Scan billets — accessible aux admins et aux agences actives */}
            <Route
              path="/admin/scan"
              element={
                <ProtectedRoute requireScanAccess>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ScanAdmin />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="agencies" element={<AgenciesAdmin />} />
              <Route path="agency-bookings" element={<AgencyBookingsAdmin />} />
              <Route path="transactions" element={<TransactionsAdmin />} />
              <Route path="users" element={<UsersAdmin />} />
              <Route path="audit" element={<AuditLogAdmin />} />
              <Route path="stats" element={<StatsAdmin />} />
              <Route path="districts" element={<DistrictsAdmin />} />
              <Route path="settings" element={<SettingsAdmin />} />
            </Route>


            {/* Agency routes */}
            <Route path="/agency" element={<AgencyLayout />}>
              <Route index element={<AgencyDashboard />} />
              <Route path="branches" element={<AgencyBranches />} />
              <Route path="sub-agencies" element={<AgencySubAgencies />} />
              <Route path="managers" element={<AgencyManagers />} />
              <Route path="trips" element={<AgencyTrips />} />
              <Route path="bookings" element={<AgencyBookings />} />
              <Route path="counter-sale" element={<AgencyCounterSale />} />
              <Route path="broadcast" element={<AgencyBroadcast />} />
              <Route path="reports" element={<AgencyReports />} />
              <Route path="audit" element={<AgencyAudit />} />
              <Route path="settings" element={<AgencySettings />} />

            </Route>

            {/* Manager routes */}
            <Route path="/manager" element={<ManagerLayout />}>
              <Route index element={<ManagerDashboard />} />
              <Route path="trips" element={<ManagerTrips />} />
              <Route path="bookings" element={<ManagerBookings />} />
              <Route path="sale" element={<ManagerSale />} />
              <Route path="notifications" element={<ManagerNotifications />} />
              <Route path="report" element={<ManagerReport />} />
              <Route path="scan" element={<ScanAdmin />} />
              <Route path="boarding" element={<ManagerBoarding />} />

            </Route>


            <Route path="*" element={<NotFound />} />
          </Routes>
          <Routes>
            <Route path="/admin/*" element={null} />
            <Route path="/agency/*" element={null} />
            <Route path="/manager/*" element={null} />
            <Route path="*" element={<BottomNav />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
