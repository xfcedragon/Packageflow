import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { LoadingPlan } from "./pages/LoadingPlan";
import { PackageLabels } from "./pages/PackageLabels";
import { PackageLocator } from "./pages/PackageLocator";
import { ScanPackages } from "./pages/ScanPackages";
import { PackageProvider } from "./state";

export default function App() {
  return (
    <BrowserRouter>
      <PackageProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="scan" element={<ScanPackages />} />
            <Route path="loading-plan" element={<LoadingPlan />} />
            <Route path="locator" element={<PackageLocator />} />
            <Route path="labels" element={<PackageLabels />} />
          </Route>
        </Routes>
      </PackageProvider>
    </BrowserRouter>
  );
}
