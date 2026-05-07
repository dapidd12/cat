import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import RoomAdmin from './pages/RoomAdmin';
import RoomJoin from './pages/RoomJoin';
import RoomSession from './pages/RoomSession';
import { useAuth } from './contexts/AuthContext';
import { UploadCloud, FileText, CheckCircle } from 'lucide-react';

// Require Auth wrapper
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user || user.isAnonymous) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  return (
    <div className="flex flex-col h-screen w-full bg-[#fceea1]">
      <header className="h-16 bg-white border-b-4 border-black px-6 flex items-center justify-between z-10 shrink-0 shadow-[0_4px_0_0_#000]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border-4 border-black bg-[#ff5252] shadow-[2px_2px_0_0_#000] flex items-center justify-center text-white font-black text-xl">
            C
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase whitespace-nowrap hidden sm:block">CAT<span className="text-[#ff5252]">Genius</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 border-4 border-black bg-[#a1e2ff] font-bold text-xs uppercase shadow-[2px_2px_0_0_#000]">
            <span className="w-3 h-3 bg-white border-2 border-black block rounded-none animate-pulse"></span>
            AI Aktif
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto relative">
         <Routes>
           <Route path="/" element={<Home />} />
           <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
           <Route path="/dashboard/room/:roomId" element={<RequireAuth><RoomAdmin /></RequireAuth>} />
           <Route path="/join/:roomId" element={<RoomJoin />} />
           <Route path="/room/:roomId" element={<RoomSession />} />
         </Routes>
      </main>
    </div>
  );
}
