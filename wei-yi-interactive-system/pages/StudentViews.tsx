import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../services/api';
import { Course, Rollcall, AnswerBuzz, AttendanceStatus, RollcallType } from '../types';
import { Button, Card, Avatar } from '../components/ui';
import { LogOut, MapPin, CheckCircle, XCircle, Zap, RefreshCw, Camera, ChevronRight, Home, Clock, Trophy, BarChart3, ListChecks } from 'lucide-react';

// --- STUDENT DASHBOARD ---
const StudentDashboardHome = () => {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({ attended: 0, total: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
        api.getStudentCourses(user.id).then(setCourses);
        api.getStudentStats(user.id).then(data => {
            setStats({ attended: data.attended_count, total: data.total_rollcalls });
        });
    }
  }, [user]);

  const handleAvatarChange = () => {
     const newUrl = prompt("請輸入新的大頭照網址 (URL):", user?.avatar_url);
     if (newUrl && user) {
        api.updateAvatar(user.id, newUrl);
        alert('更新成功，請重新整理頁面'); // Simple reload prompt
     }
  };

  const attendanceRate = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0;

  return (
    <div className="pb-20 min-h-screen bg-gray-100">
      <div className="bg-blue-600 text-white p-6 pt-10 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20">
           <Zap className="w-32 h-32" />
        </div>
        <div className="flex items-center gap-4 relative z-10 mb-6">
          <div className="relative group cursor-pointer" onClick={handleAvatarChange}>
            <Avatar src={user?.avatar_url} alt={user?.name || ''} size="lg" />
            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <Camera className="text-white w-6 h-6"/>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{user?.name}</h1>
            <p className="opacity-90">{user?.username}</p>
          </div>
        </div>

        {/* Stats Cards in Header */}
        <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                <div className="flex items-center gap-2 mb-1 text-blue-100">
                    <ListChecks className="w-4 h-4" />
                    <span className="text-xs font-bold">點名次數</span>
                </div>
                <div className="text-2xl font-bold">{stats.attended} <span className="text-sm opacity-70">/ {stats.total}</span></div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                <div className="flex items-center gap-2 mb-1 text-blue-100">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-xs font-bold">出席率</span>
                </div>
                <div className="text-2xl font-bold">{attendanceRate}%</div>
            </div>
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">我的課程</h2>
        <div className="space-y-4">
          {courses.map(course => (
            <Card key={course.id} className="active:scale-95 transition-transform cursor-pointer border-l-4 border-blue-500" >
               <div onClick={() => navigate(`/student/course/${course.id}`)} className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800">{course.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">點擊進入互動</p>
                  </div>
                  <ChevronRight className="text-gray-300"/>
               </div>
            </Card>
          ))}
          {courses.length === 0 && <p className="text-center text-gray-400 py-8">尚無課程</p>}
        </div>

        <Button variant="outline" className="w-full mt-8 bg-white" onClick={logout}>
           <LogOut className="w-4 h-4 mr-2"/> 登出系統
        </Button>
      </div>
    </div>
  );
};

// --- STUDENT COURSE ACTIONS ---
const StudentCourseView = () => {
   const { id } = useParams();
   const navigate = useNavigate();
   if(!id) return null;

   return (
     <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
        <header className="mb-8 flex items-center gap-2">
           <Button variant="outline" className="p-2" onClick={() => navigate('/student')}><Home className="w-5 h-5"/></Button>
           <h1 className="font-bold text-xl">課堂互動</h1>
        </header>
        
        <div className="grid gap-6 flex-1 content-start">
           <button 
             onClick={() => navigate(`/student/course/${id}/attendance`)}
             className="h-32 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg text-white flex items-center justify-center gap-4 text-xl font-bold active:scale-95 transition-transform"
           >
              <CheckCircle className="w-8 h-8" />
              數位點名
           </button>

           <button 
             onClick={() => navigate(`/student/course/${id}/buzzer`)}
             className="h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-lg text-white flex items-center justify-center gap-4 text-xl font-bold active:scale-95 transition-transform"
           >
              <Zap className="w-8 h-8" />
              搶答活動
           </button>
        </div>
     </div>
   );
};

// --- ATTENDANCE SCREEN ---
const StudentAttendance = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'waiting' | 'active' | 'success' | 'late' | 'error'>('waiting');
  const [rollcall, setRollcall] = useState<Rollcall | null>(null);
  const [msg, setMsg] = useState('老師還沒開喔！請等待');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
     if(!id) return;
     setLoading(true);
     try {
       const active = await api.getActiveRollcall(id);
       if (active) {
         setRollcall(active);
         // Check if already checked in locally or remotely
         const data = await api.getRollcallRecords(active.id);
         const myRecord = data.records.find(r => r.student_id === user?.id);
         if (myRecord) {
             setStatus('success');
             setMsg('真認真聽講!!!');
         } else {
             setStatus('active');
             setMsg('點名進行中，請點擊下方按鈕');
         }
       } else {
         setRollcall(null);
         setStatus('waiting');
         setMsg('老師還沒開喔！請等待');
       }
     } catch(e) { setMsg('連線錯誤'); }
     setLoading(false);
  };

  const handleCheckIn = () => {
     if (!rollcall || !user || !id) return;
     setLoading(true);

     const submit = async (lat?: number, lng?: number) => {
        try {
           const rec = await api.checkIn(user.id, rollcall.id, lat, lng);
           if (rec.status === 'already_checked_in') {
             setStatus('success');
             setMsg('真認真聽講!!!');
           } else if (rec.status === AttendanceStatus.LATE) {
               setStatus('late');
               setMsg('真認真聽講!!! (遲到)');
           } else {
               setStatus('success');
               setMsg('真認真聽講!!!');
           }
        } catch (err: any) {
           setStatus('error');
           setMsg(err.message || '簽到失敗');
        } finally {
           setLoading(false);
        }
     };

     if (rollcall.type === RollcallType.GPS) {
        navigator.geolocation.getCurrentPosition(
           (pos) => submit(pos.coords.latitude, pos.coords.longitude),
           (err) => {
              setLoading(false);
              alert('無法取得 GPS 位置');
           }
        );
     } else {
        submit();
     }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
       <div className="bg-white p-4 shadow-sm flex justify-between items-center">
         <Link to={`/student/course/${id}`} className="font-bold text-gray-500">← 返回</Link>
         <h1 className="font-bold">數位點名</h1>
         <div className="w-8"></div>
       </div>

       <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-8">
          {/* Pull to refresh simulation */}
          <button 
            onClick={refresh} 
            className="absolute top-20 bg-white shadow-md px-4 py-2 rounded-full text-blue-600 text-sm font-bold flex items-center gap-2 active:scale-90 transition-transform z-10"
          >
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/> 下拉更新 (手動)
          </button>

          <div className="mt-10">
             {status === 'waiting' && <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="w-12 h-12 text-gray-400"/></div>}
             {status === 'active' && <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><MapPin className="w-12 h-12 text-blue-500"/></div>}
             {status === 'success' && <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-16 h-16 text-green-500"/></div>}
             {status === 'late' && <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-16 h-16 text-orange-500"/></div>}
             {status === 'error' && <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><XCircle className="w-16 h-16 text-red-500"/></div>}
             
             <h2 className="text-xl font-bold text-gray-800 mb-2">{msg}</h2>
             {rollcall && status === 'active' && <p className="text-gray-500">類型: {rollcall.type === 'gps' ? 'GPS 定位點名' : '一般點名'}</p>}
          </div>

          {status === 'active' && (
            <button 
              onClick={handleCheckIn} 
              disabled={loading}
              className="w-full max-w-sm bg-blue-600 text-white h-16 rounded-xl text-xl font-bold shadow-lg active:bg-blue-700 transition-colors flex items-center justify-center"
            >
               {loading ? <RefreshCw className="animate-spin"/> : '我安全到教室上課了'}
            </button>
          )}
       </div>
    </div>
  );
};

// --- BUZZER SCREEN ---
const StudentBuzzer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [buzzer, setBuzzer] = useState<AnswerBuzz | undefined>(undefined);
  const [result, setResult] = useState<'none' | 'won' | 'lost'>('none');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if(!id) return;
    setLoading(true);
    const b = await api.getBuzzerStatus(id);
    setBuzzer(b);
    
    // Determine local state based on server state
    if (b?.winner_student_id) {
        if (b.winner_student_id === user?.id) setResult('won');
        else setResult('lost');
    } else {
        setResult('none');
    }
    setLoading(false);
  };

  const handleBuzz = async () => {
      if (!buzzer || !user || !id) return;
      try {
          const res = await api.buzz(user.id, buzzer.id);
          if (res.win) setResult('won');
          else setResult('lost');
          refresh();
      } catch (e) {
          alert('搶答失敗');
      }
  };

  const isActive = buzzer && !buzzer.end_time && !buzzer.winner_student_id;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
       <div className="p-4 flex justify-between items-center">
         <Link to={`/student/course/${id}`} className="text-gray-400">← 返回</Link>
         <h1 className="font-bold">搶答器</h1>
         <div className="w-8"></div>
       </div>

       <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
          <button 
            onClick={refresh} 
            className="absolute top-4 bg-gray-800 border border-gray-700 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 active:scale-95"
          >
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/> 下拉更新
          </button>

          {!isActive && result === 'none' && (
              <div className="text-gray-400">
                 <p className="text-xl mb-2">老師還沒開喔！請等待</p>
              </div>
          )}

          {result === 'won' && (
              <div className="animate-bounce-in">
                 <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-4"/>
                 <h2 className="text-4xl font-bold text-yellow-400">恭喜搶到！</h2>
                 <p className="text-gray-300 mt-2">你是第一名</p>
              </div>
          )}

          {result === 'lost' && (
              <div>
                 <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-16 h-16 text-gray-600"/>
                 </div>
                 <h2 className="text-3xl font-bold text-gray-400">沒有搶到</h2>
                 <p className="text-gray-600 mt-2">下次手腳快一點</p>
              </div>
          )}

          {isActive && result === 'none' && (
              <button 
                 onClick={handleBuzz}
                 className="w-64 h-64 rounded-full bg-red-600 border-b-8 border-red-800 shadow-2xl flex items-center justify-center active:border-b-0 active:translate-y-2 transition-all"
              >
                 <span className="text-4xl font-black text-white tracking-widest">搶答</span>
              </button>
          )}
       </div>
    </div>
  );
};

// --- ROUTER WRAPPER ---
export default function StudentViews() {
  return (
    <Routes>
      <Route path="/" element={<StudentDashboardHome />} />
      <Route path="/course/:id" element={<StudentCourseView />} />
      <Route path="/course/:id/attendance" element={<StudentAttendance />} />
      <Route path="/course/:id/buzzer" element={<StudentBuzzer />} />
    </Routes>
  );
}