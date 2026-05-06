import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgba(10, 15, 20, 0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </div>
  );
}

export default App;
