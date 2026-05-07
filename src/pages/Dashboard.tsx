import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateRoomToken } from '../lib/utils';
import { useNavigate } from 'react-router';
import { Plus, Trash2, Edit, Key, Clock, Settings, LogOut, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('');

  const fetchRooms = async () => {
    if (!user) return;
    try {
      const q = user.email === 'saqilakhalifah@gmail.com' 
         ? collection(db, 'rooms') 
         : query(collection(db, 'rooms'), where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const roomsData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRooms(roomsData);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !user) return;
    
    const token = generateRoomToken();
    const newRoom = {
      ownerId: user.uid,
      name: newRoomName.trim(),
      token: token,
      durationMinutes: 60,
      status: 'active',
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'rooms', token), newRoom);
      setNewRoomName('');
      fetchRooms();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'rooms');
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!window.confirm('Hapus room ini beserta semua soal dan sesinya?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
      setRooms(rooms.filter(r => r.id !== roomId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${roomId}`);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="neo-card p-8 bg-white flex flex-col items-center gap-4">
        <Loader2 size={48} strokeWidth={3} className="animate-spin text-[#ff5252]" />
        <span className="font-black uppercase text-xl animate-pulse">Memuat Dashboard...</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 flex flex-col gap-8">
      <div className="flex justify-between items-center bg-white border-4 border-black p-4 sm:p-6 shadow-[4px_4px_0_0_#000]">
        <div>
          <div className="flex items-center gap-3">
             <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight">Dashboard Admin</h1>
             {user?.email === 'saqilakhalifah@gmail.com' && (
               <span className="bg-black text-white px-2 py-1 text-xs font-bold uppercase">Developer</span>
             )}
          </div>
          <p className="font-bold text-sm mt-2">{user?.email}</p>
        </div>
        <button onClick={() => { signOut(); navigate('/'); }} className="btn-secondary px-4 py-2 flex items-center gap-2 bg-[#ffa1f2]">
          <LogOut size={16} strokeWidth={3} />
          <span className="hidden sm:inline">LOGOUT</span>
        </button>
      </div>

      <div className="neo-card p-6 bg-[#a1e2ff]">
        <h2 className="text-xl font-bold uppercase border-b-4 border-black pb-2 mb-4 bg-white inline-block px-3 py-1 border-4 shadow-[2px_2px_0_0_#000]">Buat Room Baru</h2>
        <form onSubmit={handleCreateRoom} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            className="neo-input p-4 flex-1 font-bold text-lg"
            placeholder="NAMA ROOM (MISAL: TRYOUT UTBK 2026)"
            required
            maxLength={100}
          />
          <button type="submit" className="btn-primary px-8 py-3 flex items-center justify-center gap-2 bg-[#ff5252]">
            <Plus size={24} strokeWidth={3} />
            BUAT
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map(room => (
          <div key={room.id} className="neo-card p-5 bg-white flex flex-col justify-between hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] transition-all">
            <div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-black text-xl leading-tight line-clamp-2 uppercase">{room.name}</h3>
                <div className={`px-2 py-1 text-[10px] font-bold border-2 border-black uppercase ${room.status === 'active' ? 'bg-[#a1ffa1]' : 'bg-[#ccc]'}`}>
                  {room.status}
                </div>
              </div>
              
              <div className="space-y-3 mb-6 bg-[#f0f0f0] border-2 border-black p-3">
                <div className="flex items-center gap-3">
                  <Key size={16} strokeWidth={3} />
                  <span className="font-mono font-bold text-lg tracking-widest">{room.token}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock size={16} strokeWidth={3} />
                  <span className="font-bold text-sm">{room.durationMinutes} Menit</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => navigate(`/dashboard/room/${room.id}`)} className="flex-1 btn-primary py-2 text-xs bg-[#fceea1] text-black">
                <Settings size={16} className="mx-auto" strokeWidth={3} />
              </button>
              <button onClick={() => handleDelete(room.id)} className="flex-1 btn-primary py-2 text-xs bg-black text-white hover:bg-gray-800">
                <Trash2 size={16} className="mx-auto" strokeWidth={3} />
              </button>
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <div className="col-span-full neo-card p-10 text-center font-bold text-xl uppercase bg-[#fceea1]">
            Belum ada room. Buat di atas!
          </div>
        )}
      </div>
    </div>
  );
}
