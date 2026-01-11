
import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../services/api';
import { Course, Rollcall, AnswerBuzz, AttendanceStatus, RollcallType } from '../types';
import { Button, Card, Avatar } from '../components/ui';
import { LogOut, MapPin, CheckCircle, XCircle, Zap, RefreshCw, Trophy, Home } from 'lucide-react';

// Fix: Implemented missing StudentDashboardHome component
const StudentDashboardHome = () => {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (user) api.getStudentCourses(user.id).then(setCourses);
  }, [user]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">學生首頁</h1>
          <p className="text-gray-500">哈囉，{user?.name}</p>
        </div>
        <Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2"/> 登出</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map(course => (
          <Link key={course.id} to={`/student/course/${course.id}`}>
            <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
              <h3 className="text-lg font-bold">{course.name}</h3>
              <p className="text-gray-400 text-sm mt-1">點擊進入課程互動</p>
            </Card>
          </Link>
        ))}
        {courses.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            目前沒有參加任何課程
          </div>
        )}
      </div>
    </div>
  );
};

// Fix: Implemented missing StudentCourseView component
const StudentCourseView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/student')}><Home className="w-4 h-4"/></Button>
        <h1 className="text-2xl font-bold text-gray-800">課程互動</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col items-center p-8 cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => navigate(`/student/course/${id}/attendance`)}>
          <div className="bg-blue-100 p-4 rounded-full mb-4">
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold">進入點名</h3>
          <p className="text-gray-500 mt-2">點擊參與即時點名</p>
        </Card>

        <Card className="flex flex-col items-center p-8 cursor-pointer hover:bg-yellow-50 transition-colors" onClick={() => navigate(`/student/course/${id}/buzzer`)}>
          <div className="bg-yellow-100 p-4 rounded-full mb-4">
            <Zap className="w-8 h-8 text-yellow-600" />
          </div>
          <h3 className="text-xl font-bold">參與搶答</h3>
          <p className="text-gray-500 mt-2">點擊進入搶答器介面</p>
        </Card>
      </div>
    </div>
  );
};

const StudentAttendance = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'waiting' | 'active' | 'success' | 'late' | 'error'>('waiting');
  const [rollcall, setRollcall] = useState<Rollcall | null>(null);
  const [msg, setMsg] = useState('等待老師發起點名...');

  useEffect(() => {
    if (!id) return;
    // Real-time subscription to active rollcalls
    const unsub = api.subscribeActiveRollcall(id, async (rc) => {
      setRollcall(rc);
      if (rc) {
        // Check if I already checked in
        const unsubRecs = api.subscribeRollcallRecords(rc.id, (recs) => {
          const myRec = recs.find(r => r.student_id === user?.id);
          if (myRec) {
            setStatus('success');
            setMsg('簽到成功！');
          } else {
            setStatus('active');
            setMsg('點名進行中...');
          }
        });
        return () => unsubRecs();
      } else {
        setStatus('waiting');
        setMsg('尚未發起點名');
      }
    });
    return () => unsub();
  }, [id, user]);

  const handleCheckIn = async () => {
    if (!rollcall || !user) return;
    try {
      if (rollcall.type === RollcallType.GPS) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          await api.checkIn(user.id, rollcall.id, pos.coords.latitude, pos.coords.longitude);
        });
      } else {
        await api.checkIn(user.id, rollcall.id);
      }
    } catch (e) {
      alert('簽到失敗');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-6 items-center justify-center text-center">
      <div className="mb-8">
        {status === 'active' ? <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center animate-pulse"><MapPin className="w-12 h-12 text-blue-500"/></div> : 
         status === 'success' ? <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center"><CheckCircle className="w-16 h-16 text-green-500"/></div> :
         <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center"><RefreshCw className="w-12 h-12 text-gray-400"/></div>}
      </div>
      <h2 className="text-2xl font-bold mb-4">{msg}</h2>
      {status === 'active' && (
        <Button onClick={handleCheckIn} className="w-full max-w-xs h-16 text-xl">點擊簽到</Button>
      )}
      <Link to={`/student/course/${id}`} className="mt-8 text-blue-600">返回課程</Link>
    </div>
  );
};

const StudentBuzzer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [buzzer, setBuzzer] = useState<AnswerBuzz | null>(null);
  const [result, setResult] = useState<'none' | 'won' | 'lost'>('none');

  useEffect(() => {
    if (!id) return;
    const unsub = api.subscribeBuzzer(id, (b) => {
      setBuzzer(b);
      if (b?.winner_student_id) {
        setResult(b.winner_student_id === user?.id ? 'won' : 'lost');
      } else {
        setResult('none');
      }
    });
    return () => unsub();
  }, [id, user]);

  const isActive = buzzer && !buzzer.end_time && !buzzer.winner_student_id;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
       {result === 'won' ? (
         <div className="animate-bounce"><Trophy className="w-32 h-32 text-yellow-400 mx-auto"/><h2 className="text-4xl font-bold mt-4">你贏了！</h2></div>
       ) : result === 'lost' ? (
         <div><XCircle className="w-32 h-32 text-red-500 mx-auto"/><h2 className="text-2xl font-bold mt-4">慢了一步...</h2></div>
       ) : isActive ? (
         <button onClick={() => buzzer && api.buzz(user!.id, buzzer.id)} className="w-64 h-64 rounded-full bg-red-600 border-b-8 border-red-800 active:border-b-0 active:translate-y-2 text-4xl font-black">搶答</button>
       ) : (
         <p className="text-gray-500">等待搶答開始...</p>
       )}
       <Link to={`/student/course/${id}`} className="mt-12 text-gray-400">返回課程</Link>
    </div>
  );
};

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
