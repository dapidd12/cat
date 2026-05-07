import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { doc, getDoc, collection, query, getDocs, setDoc, deleteDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UploadCloud, FileText, Trash2, ArrowLeft, Users, Trophy, Loader2, Settings2, PlusCircle } from 'lucide-react';
import { parseQuestions, AIModelType } from '../services/geminiService';

import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function RoomAdmin() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  const [qText, setQText] = useState('');
  const [aText, setAText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // AI Settings State (Loaded from LocalStorage)
  const [aiModel, setAiModel] = useState<AIModelType>('gemini');
  const [apiKey, setApiKey] = useState('');

  // Manual Add State
  const [manualText, setManualText] = useState('');
  const [manualOptions, setManualOptions] = useState(['', '', '', '']);
  const [manualCorrectIdx, setManualCorrectIdx] = useState(0);
  const [manualExplanation, setManualExplanation] = useState('');

  // Auto Close State
  const [scheduledOpenAt, setScheduledOpenAt] = useState('');
  const [scheduledCloseAt, setScheduledCloseAt] = useState('');

  const fetchData = async () => {
    if (!roomId) return;
    try {
      const docSnap = await getDoc(doc(db, 'rooms', roomId));
      if (docSnap.exists()) {
         const data = docSnap.data();
         setRoom({ id: docSnap.id, ...data });
         if (data.scheduledOpenAt) setScheduledOpenAt(data.scheduledOpenAt);
         if (data.scheduledCloseAt) setScheduledCloseAt(data.scheduledCloseAt);
      }

      const qSnap = await getDocs(collection(db, 'rooms', roomId, 'questions'));
      const qData = qSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.number - b.number);
      setQuestions(qData);

      const lSnap = await getDocs(query(collection(db, 'rooms', roomId, 'sessions'), orderBy('score', 'desc')));
      setLeaderboard(lSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
    }
  };

  useEffect(() => {
    fetchData();
    // Load local AI config
    const savedModel = localStorage.getItem(`ai_model_${roomId}`) as AIModelType;
    const savedKey = localStorage.getItem(`ai_key_${roomId}`);
    if (savedModel) setAiModel(savedModel);
    if (savedKey) setApiKey(savedKey);
  }, [roomId]);

  const saveAIConfig = (model: AIModelType, key: string) => {
     setAiModel(model);
     setApiKey(key);
     localStorage.setItem(`ai_model_${roomId}`, model);
     localStorage.setItem(`ai_key_${roomId}`, key);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setter(fullText);
      } else if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setter(result.value);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) setter(event.target.result as string);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error("Error reading file:", err);
      alert("Gagal membaca file: " + file.name);
    }
  };

  const handleGenerateAndMerge = async () => {
    if (!qText.trim()) return;
    setIsGenerating(true);
    setError('');
    try {
      const generated = await parseQuestions(qText, aText, aiModel, apiKey);
      
      let nextNumber = questions.length > 0 ? Math.max(...questions.map(q => q.number)) + 1 : 1;
      let added = 0;
      
      for (const q of generated) {
         const isDuplicate = questions.some(existingQ => 
            existingQ.text.trim().toLowerCase() === q.text.trim().toLowerCase()
         );
         
         if (isDuplicate) continue;
         
         const qRef = doc(collection(db, 'rooms', roomId!, 'questions'));
         await setDoc(qRef, {
           roomId: roomId,
           number: nextNumber++,
           text: q.text,
           options: q.options,
           correctAnswerIndex: q.correctAnswerIndex,
           explanation: q.explanation || '',
           createdAt: serverTimestamp()
         });
         added++;
      }
      setQText('');
      setAText('');
      fetchData();
      alert(`Berhasil generate & tambah ${added} soal baru! (Terdeteksi ${generated.length - added} duplikat)`);
    } catch (err: any) {
      setError(err.message || 'Gagal generate soal.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualAdd = async () => {
     if (!manualText.trim() || manualOptions.some(o => !o.trim())) {
         alert("Soal dan semua opsi harus diisi!");
         return;
     }
     
     try {
         let nextNumber = questions.length > 0 ? Math.max(...questions.map(q => q.number)) + 1 : 1;
         const qRef = doc(collection(db, 'rooms', roomId!, 'questions'));
         await setDoc(qRef, {
           roomId: roomId,
           number: nextNumber,
           text: manualText,
           options: manualOptions,
           correctAnswerIndex: manualCorrectIdx,
           explanation: manualExplanation || '',
           createdAt: serverTimestamp()
         });
         setManualText('');
         setManualOptions(['', '', '', '']);
         setManualCorrectIdx(0);
         setManualExplanation('');
         fetchData();
         alert("Soal manual berhasil ditambahkan!");
     } catch (err) {
         console.error(err);
         alert("Gagal menambahkan soal.");
     }
  }

  const handleDeleteQuestion = async (qId: string) => {
    if(!window.confirm('Hapus soal?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId!, 'questions', qId));
      fetchData();
    } catch(err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${roomId}/questions/${qId}`);
    }
  }

  const handleUpdateDuration = async (minutes: number) => {
    if (minutes < 1) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId!), { 
        durationMinutes: minutes,
        updatedAt: serverTimestamp() 
      });
      fetchData();
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
    }
  }

  const handleUpdateSchedule = async (field: 'scheduledOpenAt' | 'scheduledCloseAt', value: string) => {
     try {
        await updateDoc(doc(db, 'rooms', roomId!), {
           [field]: value,
           updatedAt: serverTimestamp()
        });
        fetchData();
     } catch(err) {
        handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
     }
  }

  const handleToggleStatus = async () => {
    try {
      const newStatus = room.status === 'active' ? 'closed' : 'active';
      const updates: any = { 
        status: newStatus,
        updatedAt: serverTimestamp()
      };
      if (newStatus === 'active' && room.durationMinutes) {
         updates.expiresAt = new Date(Date.now() + room.durationMinutes * 60000);
      }
      await updateDoc(doc(db, 'rooms', roomId!), updates);
      fetchData();
    } catch(err) {
       handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
    }
  }

  if (!room) return (
    <div className="h-full flex items-center justify-center min-h-[50vh]">
      <div className="neo-card p-8 bg-white flex flex-col items-center gap-4">
        <Loader2 size={48} strokeWidth={3} className="animate-spin text-[#ff5252]" />
        <span className="font-black uppercase text-xl animate-pulse">Memuat Room...</span>
      </div>
    </div>
  );

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${room.token}` : '';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border-4 border-black p-4 sm:p-6 shadow-[4px_4px_0_0_#000] gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary p-2 bg-[#fceea1]">
            <ArrowLeft size={24} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight line-clamp-1">{room.name}</h1>
            <div className="flex gap-4 mt-2 text-sm font-bold uppercase overflow-x-auto whitespace-nowrap hide-scroll">
              <span className="bg-[#a1ffa1] border-2 border-black px-2 py-0.5">TOKEN: {room.token}</span>
              <span className={room.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                {room.status === 'active' ? 'AKTIF' : 'DITUTUP'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleToggleStatus} className={`btn-primary px-4 py-2 text-xs ${room.status === 'active' ? 'bg-black text-white' : 'bg-[#a1ffa1] text-black'}`}>
            {room.status === 'active' ? 'TUTUP ROOM' : 'BUKA ROOM'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          <div className="neo-card p-6 bg-white">
            <h2 className="text-xl font-bold uppercase border-b-4 border-black pb-2 mb-4 bg-[#a1ffa1] inline-block px-3 py-1 border-4 shadow-[2px_2px_0_0_#000]">Tambah Soal Manual</h2>
            <div className="flex flex-col gap-3">
              <textarea placeholder="Tuliskan soal disini..." value={manualText} onChange={e => setManualText(e.target.value)} className="neo-input p-3 font-medium text-sm h-24" />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 {manualOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                       <input 
                         type="radio" 
                         name="correctIdx" 
                         checked={manualCorrectIdx === i} 
                         onChange={() => setManualCorrectIdx(i)}
                         className="w-5 h-5 accent-black"
                       />
                       <input 
                         type="text" 
                         placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                         value={opt}
                         onChange={e => {
                            const newOpts = [...manualOptions];
                            newOpts[i] = e.target.value;
                            setManualOptions(newOpts);
                         }}
                         className="neo-input p-2 flex-1 text-sm"
                       />
                    </div>
                 ))}
                 <button onClick={() => setManualOptions([...manualOptions, ''])} className="border-4 border-black border-dashed flex items-center justify-center p-2 text-xs font-bold uppercase hover:bg-gray-100 transition">
                    + Tambah Opsi
                 </button>
              </div>
              
              <input type="text" placeholder="Penjelasan jawaban (opsional)" value={manualExplanation} onChange={e => setManualExplanation(e.target.value)} className="neo-input p-3 text-sm mt-2" />
              <button onClick={handleManualAdd} className="btn-primary mt-2 py-3 bg-[black] text-white flex justify-center gap-2">
                <PlusCircle size={20} strokeWidth={3} /> TAMBAH MANUAL
              </button>
            </div>
          </div>

          {/* Upload Section */}
          <div className="neo-card p-6 bg-[#ffa1f2]">
            <h2 className="text-xl font-bold uppercase border-b-4 border-black pb-2 mb-4 bg-white inline-block px-3 py-1 border-4 shadow-[2px_2px_0_0_#000]">Tambah Soal via AI</h2>
            
            <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] mb-6 flex flex-col gap-3">
               <h3 className="font-bold uppercase text-sm border-b-2 border-black pb-1 mb-2 flex items-center gap-2"><Settings2 size={16}/> Konfigurasi AI (Opsional)</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase block mb-1">Pilih Model</label>
                    <select value={aiModel} onChange={e => saveAIConfig(e.target.value as AIModelType, apiKey)} className="neo-input w-full p-2 text-sm bg-white">
                       <option value="gemini">Gemini</option>
                       <option value="deepseek">DeepSeek</option>
                       <option value="claude">Claude (Not Recomended/CORS)</option>
                       <option value="kimi">Kimi (Moonshot)</option>
                       <option value="qwen">Qwen (DashScope)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase block mb-1">API Key Model</label>
                    <input type="password" value={apiKey} onChange={e => saveAIConfig(aiModel, e.target.value)} placeholder="Biarkan kosong pakai Bawaan App" className="neo-input w-full p-2 text-sm" />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
               <div>
                  <label className="block text-xs font-bold uppercase mb-2">Soal (.txt, .pdf, .docx, paste)</label>
                  <textarea value={qText} onChange={e => setQText(e.target.value)} className="w-full neo-input h-32 p-3 text-xs font-mono" placeholder="Paste materi / soal... AI akan menemukan pilihan ganda." />
                  <input type="file" accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, setQText)} className="text-xs font-bold mt-2 w-full" />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase mb-2">Kunci (.txt, .pdf, .docx, paste)</label>
                  <textarea value={aText} onChange={e => setAText(e.target.value)} className="w-full neo-input h-32 p-3 text-xs font-mono" placeholder="Paste kunci (Opsional)..." />
                  <input type="file" accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, setAText)} className="text-xs font-bold mt-2 w-full" />
               </div>
            </div>
            {error && <div className="bg-red-500 text-white font-bold p-2 border-2 border-black mb-4">{error}</div>}
            <button onClick={handleGenerateAndMerge} disabled={isGenerating || !qText} className="w-full btn-primary py-3 bg-white text-black disabled:bg-gray-300 flex justify-center gap-2">
              <FileText strokeWidth={3} /> {isGenerating ? 'AI SEDANG MEMPROSES...' : 'GENERATE VIA AI'}
            </button>
          </div>

          {/* Questions List */}
          <div className="neo-card p-6 bg-white">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold uppercase border-b-4 border-black pb-2 bg-[#a1e2ff] inline-block px-3 py-1 border-4 shadow-[2px_2px_0_0_#000]">Daftar Soal ({questions.length})</h2>
             </div>
             <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
               {questions.map((q, idx) => (
                 <div key={q.id} className="border-4 border-black p-4 relative">
                   <div className="absolute -top-3 -left-3 w-8 h-8 bg-[#fceea1] border-4 border-black font-black flex items-center justify-center">{idx + 1}</div>
                   <button onClick={() => handleDeleteQuestion(q.id)} className="absolute top-2 right-2 p-1 bg-black text-white hover:bg-red-500 transition-colors">
                     <Trash2 size={16} strokeWidth={3} />
                   </button>
                   <p className="font-bold text-sm mb-3 mt-2 pr-6 line-clamp-2">{q.text}</p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {q.options.map((opt: string, oid: number) => (
                       <div key={oid} className={`text-xs p-2 border-2 border-black font-medium ${oid === q.correctAnswerIndex ? 'bg-[#a1ffa1] font-bold' : 'bg-gray-50'}`}>
                         {String.fromCharCode(65 + oid)}. {opt}
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               {questions.length === 0 && <p className="text-center font-bold uppercase text-gray-500 py-8">Belum ada soal.</p>}
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
           {/* Settings */}
           <div className="neo-card p-6 bg-[#fceea1]">
             <h2 className="text-xl font-bold uppercase border-b-4 border-black pb-2 mb-4 bg-white inline-block px-3 py-1 border-4 shadow-[2px_2px_0_0_#000]">Pengaturan</h2>
             
             <div className="mb-4">
               <label className="block text-xs font-bold uppercase mb-2">Waktu Pengerjaan (Menit)</label>
               <input type="number" defaultValue={room.durationMinutes} onBlur={e => {
                 const val = parseInt(e.target.value);
                 if (!isNaN(val) && val >= 1) handleUpdateDuration(val);
               }} className="neo-input p-2 w-full font-bold" min="1" />
             </div>

             <div className="mb-4">
               <label className="block text-xs font-bold uppercase mb-2">Jadwal Buka (Opsional)</label>
               <input type="datetime-local" value={scheduledOpenAt} onChange={e => {
                  setScheduledOpenAt(e.target.value);
                  handleUpdateSchedule('scheduledOpenAt', e.target.value);
               }} className="neo-input p-2 w-full text-sm font-bold bg-white" />
             </div>

             <div className="mb-4">
               <label className="block text-xs font-bold uppercase mb-2">Jadwal Tutup (Opsional)</label>
               <input type="datetime-local" value={scheduledCloseAt} onChange={e => {
                  setScheduledCloseAt(e.target.value);
                  handleUpdateSchedule('scheduledCloseAt', e.target.value);
               }} className="neo-input p-2 w-full text-sm font-bold bg-white" />
             </div>

             <div className="mb-4">
               <label className="block text-xs font-bold uppercase mb-2">Link Bergabung</label>
               <input type="text" readOnly value={appUrl} className="neo-input p-2 w-full text-[10px] font-mono bg-white cursor-pointer" onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(appUrl); alert('Link disalin!'); }} />
             </div>
           </div>

           {/* Leaderboard */}
           <div className="neo-card p-6 bg-white flex-1">
             <div className="flex items-center gap-3 mb-6">
               <Trophy size={28} strokeWidth={3} className="text-[#ff5252]" />
               <h2 className="text-xl font-bold uppercase border-b-4 border-black pb-2">Leaderboard</h2>
             </div>
             
             <div className="space-y-3">
               {leaderboard.map((lb, idx) => (
                 <div key={lb.id} className={`flex items-center gap-3 p-3 border-4 border-black ${idx === 0 ? 'bg-[#fceea1]' : idx === 1 ? 'bg-gray-100' : idx === 2 ? 'bg-[#ffebd6]' : 'bg-white'}`}>
                   <div className="font-black text-lg w-6 text-center">{idx + 1}</div>
                   <div className="flex-1 font-bold truncate uppercase max-w-[120px]">{lb.participantName}</div>
                   <div className="font-black text-xl ml-auto">{lb.score}/{lb.maxScore}</div>
                 </div>
               ))}
               {leaderboard.length === 0 && <p className="text-center font-bold uppercase text-xs text-gray-500">Belum ada peserta</p>}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
