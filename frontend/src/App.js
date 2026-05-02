import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ProvidersList from "@/pages/ProvidersList";
import ProviderDetail from "@/pages/ProviderDetail";
import UploadExtract from "@/pages/UploadExtract";
import AddProvider from "@/pages/AddProvider";
import AiSearch from "@/pages/AiSearch";
import MapView from "@/pages/MapView";
import BestValue from "@/pages/BestValue";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/providers" element={<ProvidersList />} />
            <Route path="/providers/:id" element={<ProviderDetail />} />
            <Route path="/upload" element={<UploadExtract />} />
            <Route path="/add" element={<AddProvider />} />
            <Route path="/search" element={<AiSearch />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/best-value" element={<BestValue />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </div>
  );
}

export default App;
