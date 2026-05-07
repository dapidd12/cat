import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, Loader2 } from 'lucide-react';

export default function RoomJoin() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [qCount, setQCount] = useState(0);
  const { user, signInAsParticipant } = useAuth();

  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId) return;
      try {
        const docSnap = await getDoc(doc(db, 'rooms', roomId));
        if (docSnap.exists()) {
          setRoom(docSnap.data());
          const qs = await getDocs(collection(db, 'rooms', roomId, 'questions'));
          setQCount(qs.size);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomId]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !room || !roomId) return;
    
    let isExpired = false;
    if (room.expiresAt && room.expiresAt.toDate() < new Date()) {
       isExpired = true;
       // Automatically close it locally for this session
       if (room.status === 'active') {
          // You could also trigger a write here, but read-only block is enough
       }
    }

    if (room.status !== 'active' || isExpired) {
       alert("Room sudah ditutup atau waktu telah habis!");
       return;
    }
    
    setLoading(true);
    await signInAsParticipant();
    
    // Create Session
    const sessionId = `${roomId}_${Date.now()}`;
    try {
      await setDoc(doc(db, 'rooms', roomId, 'sessions', sessionId), {
        roomId,
        participantName: name.trim().toUpperCase(),
        score: 0,
        maxScore: qCount,
        uid: auth.currentUser?.uid || '',
        status: 'taking',
        startedAt: serverTimestamp()
      });
      navigate(`/room/${roomId}?session=${sessionId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}/sessions`);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="neo-card p-8 bg-white flex flex-col items-center gap-4">
        <Loader2 size={48} strokeWidth={3} className="animate-spin text-[#ff5252]" />
        <span className="font-black uppercase text-xl animate-pulse">Menyiapkan Ujian...</span>
      </div>
    </div>
  );

  if (!room) return <div className="p-8 font-bold uppercase text-2xl bg-white border-4 border-black inline-block m-8 shadow-[4px_4px_0_0_#000]">Room Tidak Ditemukan!</div>;

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md neo-card neo-card-yellow p-8 flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#ff5252] mb-1">ROOM UJIAN</h2>
          <h1 className="text-3xl font-black uppercase tracking-tight leading-tight">{room.name}</h1>
        </div>
        
        <div className="bg-white border-4 border-black p-4 space-y-2">
           <div className="flex justify-between font-bold text-sm uppercase">
             <span>Waktu</span>
             <span>{room.durationMinutes} Menit</span>
           </div>
           <div className="flex justify-between font-bold text-sm uppercase">
             <span>Jumlah Soal</span>
             <span>{qCount} Soal</span>
           </div>
           <div className="flex justify-between font-bold text-sm uppercase">
             <span>Status</span>
             <span className={room.status === 'active' ? 'text-green-600' : 'text-red-600'}>{room.status === 'active' ? 'AKTIF' : 'DITUTUP'}</span>
           </div>
        </div>

        <form onSubmit={handleStart} className="flex flex-col gap-4 mt-2">
          <label className="text-xs font-bold uppercase">Nama Lengkap</label>
          <div className="relative">
             <User className="absolute left-4 top-1/2 transform -translate-y-1/2" strokeWidth={3} size={20} />
             <input
               type="text"
               value={name}
               onChange={(e) => setName(e.target.value)}
               className="neo-input p-4 pl-12 text-lg font-bold w-full uppercase"
               placeholder="NAMA LENGKAP"
               required
               maxLength={50}
               disabled={room.status !== 'active' || qCount === 0}
             />
          </div>
          <button 
            type="submit" 
            className="btn-primary py-4 text-xl mt-2 disabled:bg-gray-400"
            disabled={room.status !== 'active' || qCount === 0 || !name.trim()}
          >
            {room.status !== 'active' ? 'ROOM DITUTUP' : qCount === 0 ? 'SOAL KOSONG' : 'MULAI UJIAN'}
          </button>
        </form>
      </div>
    </div>
  );
}
