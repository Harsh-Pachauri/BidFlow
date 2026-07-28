import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { AuctionListingPage } from "../pages/AuctionListingPage";
import { AuctionDetailsPage } from "../pages/AuctionDetailsPage";
import { CreateRfqPage } from "../pages/CreateRfqPage";
import { Layout } from "../components/Layout";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<AuctionListingPage />} />
            <Route path="/rfqs/:id" element={<AuctionDetailsPage />} />
            <Route element={<ProtectedRoute role="BUYER" />}>
              <Route path="/rfqs/new" element={<CreateRfqPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
