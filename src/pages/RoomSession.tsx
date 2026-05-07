import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { doc, getDoc, collection, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Clock, ChevronRight, CheckCircle, Flag, XCircle, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function RoomSession() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'taking' | 'results'>('taking');
  
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const initTest = async () => {
      if (!roomId || !sessionId) return navigate('/');
      try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomId));
        if (!roomDoc.exists()) return navigate('/');
        const roomData = roomDoc.data();
        setRoom(roomData);

        const sessionDoc = await getDoc(doc(db, 'rooms', roomId, 'sessions', sessionId));
        if (!sessionDoc.exists()) return navigate('/');
        
        const sessData = sessionDoc.data();
        if (sessData.uid !== auth.currentUser?.uid) return navigate('/'); // security check client side
        setSession(sessData);

        const qSnap = await getDocs(collection(db, 'rooms', roomId, 'questions'));
        let qData = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        qData.sort((a: any, b: any) => a.number - b.number);
        setQuestions(qData);

        if (sessData.status === 'finished') {
           setView('results');
           // In real-world, we'd load answers from sessData if we saved them, but here we just show score
        } else {
           // calculate remaining time
           const startedAt = sessData.startedAt?.toDate() || new Date();
           const now = new Date();
           const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
           const totalSeconds = roomData.durationMinutes * 60;
           let rem = totalSeconds - elapsed;
           if (rem < 0) rem = 0;
           setTimeRemaining(rem);
           if (rem === 0) {
             handleSubmit(); // Auto submit if time is up on reload
           }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
      } finally {
        setLoading(false);
      }
    };
    initTest();
  }, [roomId, sessionId]);

  useEffect(() => {
    if (view === 'taking' && timeRemaining > 0 && !loading) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [view, timeRemaining, loading]);

  const handleSubmit = async (e?: React.MouseEvent) => {
    if (e && !window.confirm("Apakah Anda yakin ingin menyelesaikan ujian?")) return;
    
    // Calculate Score
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswerIndex) {
        score += 1;
      }
    });

    try {
       await updateDoc(doc(db, 'rooms', roomId!, 'sessions', sessionId!), {
          score,
          status: 'finished',
          finishedAt: serverTimestamp()
       });
       if(session) {
          setSession({ ...session, score, status: 'finished' });
       }
       setView('results');
    } catch(err) {
       handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/sessions/${sessionId}`);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (questions.length === 0) return;
    setAnswers(prev => ({
      ...prev,
      [questions[currentQuestionIndex].id]: optionIndex
    }));
  };

  const toggleFlag = () => {
    if (questions.length === 0) return;
    const qId = questions[currentQuestionIndex].id;
    setFlagged(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="p-8 font-bold uppercase text-2xl">Loading Session...</div>;
  if (!questions || questions.length === 0) return <div className="p-8 font-bold uppercase text-2xl">Room Kosong</div>;

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion.id];
  const isFlagged = flagged[currentQuestion.id];

  if (view === 'results') {
    const percentage = Math.round((session?.score / questions.length) * 100) || 0;
    return (
      <div className="max-w-4xl mx-auto flex flex-col gap-6 h-full overflow-y-auto p-4 py-8">
        <div className="neo-card neo-card-yellow p-8 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-6">
          <div className="text-center sm:text-left">
             <h1 className="text-3xl font-black text-black mb-2 uppercase border-b-4 border-black inline-block pb-1">Ujian Selesai!</h1>
             <p className="text-xl text-black font-bold mt-2 uppercase">{session?.participantName}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
            <div className="text-center">
              <div className="text-4xl font-black text-[#ff5252]">{session?.score}<span className="text-xl text-black">/{questions.length}</span></div>
              <div className="uppercase tracking-widest text-[10px] font-bold text-black mt-1">Benar</div>
            </div>
            <div className="w-full sm:w-1 h-1 sm:h-12 bg-black"></div>
            <div className="text-center">
              <div className="text-4xl font-black text-black">{percentage}%</div>
              <div className="uppercase tracking-widest text-[10px] font-bold text-black mt-1">Akurasi</div>
            </div>
            <div className="sm:ml-4 flex flex-col">
               <button onClick={() => navigate('/')} className="btn-primary py-3 px-6 text-sm flex-shrink-0">
                 KEMBALI KE HOME
               </button>
            </div>
          </div>
        </div>
        
        {/* We won't show full answers to participants to prevent cheating, just the score */}
        <div className="neo-card p-8 bg-white flex flex-col items-center justify-center text-center gap-4">
           <Trophy size={48} strokeWidth={3} className="text-[#a1ffa1]" />
           <h2 className="text-2xl font-black uppercase">Skor Tersimpan di Leaderboard!</h2>
           <p className="font-bold">Admin room dapat melihat peringkat kamu secara langsung.</p>
        </div>
      </div>
    );
  }

  // view === 'taking'
  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto overflow-hidden p-4">
      <div className="neo-card flex-1 flex flex-col overflow-hidden">
         <div className="px-5 py-4 border-b-4 border-black bg-white flex items-center justify-between shrink-0">
           <div className="flex items-center gap-3">
             <span className="px-2 py-1 bg-black text-white text-[10px] font-bold rounded-sm uppercase tracking-wider hidden sm:block">{session?.participantName}</span>
             <h3 className="text-sm font-bold uppercase">Soal {currentQuestionIndex + 1} dari {questions.length}</h3>
           </div>
           <div className={`flex items-center gap-2 font-bold px-3 py-1 border-2 border-black ${timeRemaining < 60 ? 'bg-[#ff5252] text-white animate-pulse' : 'bg-[#a1ffa1] text-black'}`}>
             <Clock size={16} strokeWidth={3} />
             {formatTime(timeRemaining)}
           </div>
         </div>

         <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
           <div className="flex gap-4">
             <div className="w-10 h-10 border-4 border-black bg-[#ffa1f2] text-black flex items-center justify-center font-bold text-lg shrink-0">
               {String(currentQuestionIndex + 1).padStart(2, '0')}
             </div>
             <div className="flex-1 space-y-6">
               <p className="text-lg leading-relaxed font-semibold text-black whitespace-pre-line">
                 {currentQuestion.text}
               </p>
               <div className="grid gap-3">
                 {currentQuestion.options.map((option: string, idx: number) => {
                   const isSelected = currentAnswer === idx;
                   return (
                     <button
                       key={idx}
                       onClick={() => handleAnswer(idx)}
                       className={`p-4 text-sm flex items-center justify-between transition-transform cursor-pointer text-left border-4 border-black box-border ${
                         isSelected 
                           ? 'bg-[#a1e2ff] font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-x-[2px] -translate-y-[2px]' 
                           : 'bg-white hover:bg-[#f0f0f0]'
                       }`}
                     >
                       <div className="flex items-center gap-4">
                         <span className="text-black font-bold uppercase">{String.fromCharCode(65 + idx)}.</span>
                         <span className="text-black font-medium">{option}</span>
                       </div>
                       <div className={`w-5 h-5 border-2 border-black ${isSelected ? 'bg-black' : 'bg-white'}`}></div>
                     </button>
                   );
                 })}
               </div>
             </div>
           </div>
         </div>

         <div className="h-20 px-5 border-t-4 border-black bg-white flex flex-row items-center justify-between shrink-0 gap-2">
           <div className="flex items-center gap-2 sm:gap-3">
             <button
               onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
               disabled={currentQuestionIndex === 0}
               className="btn-secondary px-4 sm:px-6 py-2 text-xs sm:text-sm disabled:opacity-50"
             >
               Kembali
             </button>
             <button
               onClick={toggleFlag}
               className={`px-3 sm:px-6 py-2 text-xs sm:text-sm font-bold border-4 border-black flex items-center gap-2 transition-transform ${
                 isFlagged 
                   ? 'bg-[#fceea1] hover:scale-[1.02] shadow-[2px_2px_0_0_#000]' 
                   : 'bg-white hover:bg-gray-100'
               }`}
             >
               <Flag size={16} strokeWidth={3} className={isFlagged ? "fill-black" : ""} />
               <span className="hidden sm:inline">{isFlagged ? 'Raguragu' : 'Ragu'}</span>
             </button>
           </div>
           
           {currentQuestionIndex === questions.length - 1 ? (
             <button onClick={handleSubmit} className="px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold bg-[#ff5252] text-white border-4 border-black flex items-center gap-2 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[4px_4px_0_0_#000] transition-transform uppercase">
               <CheckCircle size={18} strokeWidth={3} /> Selesai
             </button>
           ) : (
             <button onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))} className="btn-primary px-4 sm:px-6 py-2 text-xs sm:text-sm flex items-center gap-2">
               <span className="hidden sm:inline">Lanjut</span><ChevronRight size={18} strokeWidth={3} />
             </button>
           )}
         </div>
      </div>

      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
        <div className="neo-card p-5 h-full flex flex-col text-black bg-white">
          <h3 className="font-bold text-sm uppercase tracking-widest border-b-4 border-black pb-3 mb-4">Navigasi Soal</h3>
          
          <div className="grid grid-cols-5 gap-3 content-start flex-grow overflow-y-auto pr-2">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isCurrent = currentQuestionIndex === idx;
              const isFlag = flagged[q.id];

              let btnClass = "w-full aspect-square border-2 border-black flex items-center justify-center font-bold text-xs transition-transform cursor-pointer relative hover:scale-105 ";
              if (isCurrent) btnClass += "border-4 border-black bg-white z-10 scale-110 shadow-[4px_4px_0_0_#000] ";
              if (isFlag) btnClass += "bg-[#fceea1] text-black ";
              else if (isAnswered) btnClass += "bg-[#a1e2ff] text-black ";
              else btnClass += "bg-white text-black ";

              return (
                <button key={q.id} onClick={() => setCurrentQuestionIndex(idx)} className={btnClass}>
                  {isFlag && <div className="absolute top-0 right-0 w-3 h-3 bg-[#ff5252] border-b-2 border-l-2 border-black"></div>}
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t-4 border-black space-y-3 shrink-0 hidden sm:block">
              <div className="flex items-center gap-3 text-xs uppercase font-bold tracking-wider">
                 <div className="w-5 h-5 border-2 border-black bg-[#a1e2ff]"></div> Terisi
              </div>
              <div className="flex items-center gap-3 text-xs uppercase font-bold tracking-wider">
                 <div className="w-5 h-5 border-2 border-black bg-[#fceea1] relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#ff5252] border-b border-l border-black"></div>
                 </div> Ragu
              </div>
              <div className="flex items-center gap-3 text-xs uppercase font-bold tracking-wider">
                 <div className="w-5 h-5 border-2 border-black bg-white"></div> Kosong
              </div>
          </div>
          <button onClick={handleSubmit} className="w-full mt-6 py-3 border-4 border-black bg-[#ff5252] text-white font-bold text-sm uppercase hover:bg-black transition-colors">
            Kumpulkan Ujian
          </button>
        </div>
      </div>
    </div>
  );
}
