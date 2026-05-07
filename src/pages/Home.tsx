import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

export default function Home() {
  const [token, setToken] = useState('');
  const navigate = useNavigate();
  const { user, signInWithGoogle, signInAsParticipant } = useAuth();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    await signInAsParticipant();
    navigate(`/join/${token.toUpperCase().trim()}`);
  };

  const handleLogin = async () => {
    if (user && !user.isAnonymous) {
      navigate('/dashboard');
    } else {
      await signInWithGoogle();
      navigate('/dashboard');
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md neo-card neo-card-blue p-8 flex flex-col gap-6">
        <h1 className="text-3xl font-black uppercase text-center border-b-4 border-black pb-4 bg-white p-2 border-4 shadow-[4px_4px_0_0_#000]">
          Gabung Room Ujian
        </h1>
        
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="neo-input p-4 text-xl font-bold text-center uppercase tracking-widest"
            placeholder="KODE ROOM"
            maxLength={10}
            required
          />
          <button type="submit" className="btn-primary py-4 text-xl">
            MASUK
          </button>
        </form>

        <div className="flex items-center gap-4 my-2">
          <div className="h-1 flex-1 bg-black"></div>
          <span className="font-bold uppercase text-xs bg-white px-2 border-2 border-black">ATAU</span>
          <div className="h-1 flex-1 bg-black"></div>
        </div>

        <button 
          onClick={handleLogin}
          className="btn-secondary py-3 text-sm flex items-center justify-center gap-3 bg-white"
        >
          <LogIn size={20} strokeWidth={3} />
          {user && !user.isAnonymous ? 'KE DASHBOARD ADMIN' : 'LOGIN GOOGLE (BUAT ROOM)'}
        </button>
      </div>
    </div>
  );
}
