import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import SearchResults from "./pages/SearchResults";
import TripDetails from "./pages/TripDetails";
import BookingPage from "./pages/BookingPage";
import BookingHistory from "./pages/BookingHistory";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Preferences from "./pages/Preferences";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AgenciesAdmin from "./pages/admin/AgenciesAdmin";
import TransactionsAdmin from "./pages/admin/TransactionsAdmin";
import UsersAdmin from "./pages/admin/UsersAdmin";
import StatsAdmin from "./pages/admin/StatsAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import AgencyLayout from "./pages/agency/AgencyLayout";
import AgencyDashboard from "./pages/agency/AgencyDashboard";
import AgencyTrips from "./pages/agency/AgencyTrips";
import AgencyBookings from "./pages/agency/AgencyBookings";
import AgencySettings from "./pages/agency/AgencySettings";
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
            <Route path="/search" element={<SearchResults />} />
            <Route path="/trip/:id" element={<TripDetails />} />
            <Route path="/booking/:id" element={<BookingPage />} />
            <Route path="/bookings" element={<BookingHistory />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/preferences" element={<Preferences />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="agencies" element={<AgenciesAdmin />} />
              <Route path="transactions" element={<TransactionsAdmin />} />
              <Route path="users" element={<UsersAdmin />} />
              <Route path="stats" element={<StatsAdmin />} />
              <Route path="settings" element={<SettingsAdmin />} />
            </Route>

            {/* Agency routes */}
            <Route path="/agency" element={<AgencyLayout />}>
              <Route index element={<AgencyDashboard />} />
              <Route path="trips" element={<AgencyTrips />} />
              <Route path="bookings" element={<AgencyBookings />} />
              <Route path="settings" element={<AgencySettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Routes>
            <Route path="/admin/*" element={null} />
            <Route path="/agency/*" element={null} />
            <Route path="*" element={<BottomNav />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
