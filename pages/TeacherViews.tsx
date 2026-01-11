
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../services/api';
import { Course, Rollcall, RollcallRecord, User, RollcallType, AttendanceStatus, AnswerBuzz, Role } from '../types';
import { Button, Card, Avatar, StatusBadge } from '../components/ui';
import { 
  LogOut, Plus, Trash2, Users, MapPin, Clock, Upload, 
  Play, StopCircle, Trophy, Zap, RefreshCw, Download, Settings, Eye, EyeOff, Key, Save, X, Search, Home 
} from 'lucide-react';
// Added missing Firebase imports
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const TeacherDashboardHome = () => {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseName, setNewCourseName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) api.getCourses(user.id).then(setCourses);
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !user) return;
    const c = await api.createCourse(user.id, newCourseName);
    setCourses([...courses, c]);
    setNewCourseName('');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">老師管理後台 (Cloud)</h1>
          <p className="text-gray-500">歡迎回來，{user?.name}</p>
        </div>
        <div className="flex gap-2">
           <Link to="/teacher/users"><Button variant="secondary"><Settings className="w-4 h-4 mr-2"/> 帳號管理</Button></Link>
           <Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2"/> 登出</Button>
        </div>
      </div>
      <Card className="mb-8">
        <form onSubmit={handleCreate} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">建立新課程</label>
            <input type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="課程名稱" className="w-full border p-2 rounded-lg" required />
          </div>
          <Button type="submit"><Plus className="w-4 h-4 mr-2"/> 新增課程</Button>
        </form>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map(course => (
          <div key={course.id} className="bg-white rounded-xl shadow p-6 border border-gray-100 flex flex-col justify-between h-48 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate(`/teacher/course/${course.id}`)}>
            <h3 className="text-xl font-bold text-gray-800">{course.name}</h3>
            <div className="text-sm text-gray-400 italic">點擊進入課程</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AttendancePanel = ({ courseId, type }: { courseId: string, type: RollcallType }) => {
  const [activeRollcall, setActiveRollcall] = useState<Rollcall | null>(null);
  const [records, setRecords] = useState<RollcallRecord[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [duration, setDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    // 1. Subscribe to active rollcall
    const unsubRc = api.subscribeActiveRollcall(courseId, (rc) => {
      if (rc && rc.type === type) setActiveRollcall(rc);
      else setActiveRollcall(null);
    });

    // 2. Load all students in course once
    api.getCourseStudents(courseId).then(setStudents);

    return () => unsubRc();
  }, [courseId, type]);

  useEffect(() => {
    if (activeRollcall) {
      // 3. Subscribe to records for this active rollcall
      const unsubRecs = api.subscribeRollcallRecords(activeRollcall.id, setRecords);
      return () => unsubRecs();
    } else {
      setRecords([]);
    }
  }, [activeRollcall]);

  useEffect(() => {
    let interval: any;
    if (activeRollcall && !activeRollcall.end_time) {
      interval = setInterval(() => {
        const endTime = activeRollcall.start_time + (activeRollcall.duration_minutes * 60 * 1000);
        setTimeLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeRollcall]);

  const handleStart = () => api.startRollcall(courseId, type, duration);
  const handleStop = () => activeRollcall && api.stopRollcall(activeRollcall.id);

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {type === RollcallType.GPS ? <MapPin className="text-blue-500"/> : <Clock className="text-blue-500"/>}
          即時點名控制
        </h2>
        {!activeRollcall ? (
          <div className="flex items-center gap-2">
            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-16 border rounded p-1 text-center" />
            <Button onClick={handleStart}><Play className="w-4 h-4 mr-1"/> 開始</Button>
          </div>
        ) : (
          <Button variant="danger" onClick={handleStop}><StopCircle className="w-4 h-4 mr-1"/> 停止</Button>
        )}
      </div>

      {activeRollcall && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 text-white p-6 rounded-xl text-center">
            <div className="text-gray-400 text-xs uppercase mb-1">剩餘時間</div>
            <div className="text-4xl font-mono font-bold">{formatTime(timeLeft)}</div>
          </div>
          <div className="bg-blue-600 text-white p-6 rounded-xl text-center">
            <div className="text-blue-200 text-xs uppercase mb-1">已簽到</div>
            <div className="text-4xl font-bold">{records.length} / {students.length}</div>
          </div>
        </div>
      )}

      <div className="border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-xs font-bold uppercase text-gray-500">
            <tr>
              <th className="p-4">姓名</th>
              <th className="p-4">學號</th>
              <th className="p-4 text-center">狀態</th>
              <th className="p-4 text-right">時間</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map(s => {
              const rec = records.find(r => r.student_id === s.id);
              return (
                <tr key={s.id}>
                  <td className="p-4 flex items-center gap-2"><Avatar src={s.avatar_url} alt={s.name} size="sm"/>{s.name}</td>
                  <td className="p-4 font-mono text-sm">{s.username}</td>
                  <td className="p-4 text-center">
                    {rec ? <StatusBadge status={rec.status}/> : <span className="text-gray-300 text-xs">未到</span>}
                  </td>
                  <td className="p-4 text-right text-xs text-gray-400">{rec ? new Date(rec.time).toLocaleTimeString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BuzzerPanel = ({ courseId }: { courseId: string }) => {
  const [buzzer, setBuzzer] = useState<AnswerBuzz | null>(null);
  const [winner, setWinner] = useState<User | null>(null);

  useEffect(() => {
    const unsub = api.subscribeBuzzer(courseId, async (b) => {
      setBuzzer(b);
      if (b?.winner_student_id) {
        // Fix: Added missing Firestore imports (doc, getDoc, db)
        const uDoc = await getDoc(doc(db, 'users', b.winner_student_id));
        if (uDoc.exists()) setWinner({ id: uDoc.id, ...uDoc.data() } as User);
      } else {
        setWinner(null);
      }
    });
    return () => unsub();
  }, [courseId]);

  return (
    <div className="flex flex-col items-center py-12 text-center">
       <div className="bg-yellow-100 p-6 rounded-full mb-6"><Zap className="w-12 h-12 text-yellow-600" /></div>
       {!buzzer || buzzer.winner_student_id ? (
          <>
            <h2 className="text-2xl font-bold mb-4">準備新的搶答</h2>
            <Button onClick={() => api.startBuzzer(courseId)} className="bg-yellow-500 text-white px-8 py-3">開始搶答</Button>
            {winner && (
              <div className="mt-8 p-6 bg-yellow-50 rounded-2xl border border-yellow-200 animate-in fade-in slide-in-from-bottom-4">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2"/>
                <div className="font-bold text-2xl">{winner.name}</div>
                <div className="text-gray-500">{winner.username}</div>
              </div>
            )}
          </>
       ) : (
          <div className="animate-pulse">
            <h2 className="text-3xl font-bold text-blue-600">等待搶答中...</h2>
            <div className="mt-4 text-6xl">⏳</div>
          </div>
       )}
    </div>
  );
};

// Fix: Implemented missing UI components
const TabButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
      active ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`}
  >
    {icon}
    {label}
  </button>
);

const RandomPickPanel = ({ courseId }: { courseId: string }) => {
  const [picked, setPicked] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePick = async () => {
    setLoading(true);
    const u = await api.randomPick(courseId);
    setPicked(u);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="bg-purple-100 p-6 rounded-full mb-6 text-purple-600">
        <RefreshCw className={`w-12 h-12 ${loading ? 'animate-spin' : ''}`} />
      </div>
      <h2 className="text-2xl font-bold mb-6">隨機抽選一名學生</h2>
      <Button onClick={handlePick} isLoading={loading} className="bg-purple-600 hover:bg-purple-700">開始抽選</Button>
      
      {picked && (
        <div className="mt-8 p-6 bg-purple-50 rounded-2xl border border-purple-200 animate-in zoom-in">
          <Avatar src={picked.avatar_url} alt={picked.name} size="lg" />
          <div className="font-bold text-2xl mt-4">{picked.name}</div>
          <div className="text-gray-500">{picked.username}</div>
        </div>
      )}
    </div>
  );
};

const StudentListPanel = ({ courseId }: { courseId: string }) => {
  const [students, setStudents] = useState<User[]>([]);
  const [csvData, setCsvData] = useState('');
  const [showImport, setShowImport] = useState(false);

  const loadStudents = () => api.getCourseStudents(courseId).then(setStudents);
  useEffect(() => { loadStudents(); }, [courseId]);

  const handleImport = async () => {
    await api.importStudents(courseId, csvData);
    setCsvData('');
    setShowImport(false);
    loadStudents();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-blue-500"/> 學生名單 ({students.length})</h2>
        <Button variant="outline" onClick={() => setShowImport(!showImport)}><Upload className="w-4 h-4 mr-2"/> 匯入名單</Button>
      </div>

      {showImport && (
        <Card className="bg-gray-50">
          <label className="block text-sm font-medium mb-2">CSV 格式: 學號,姓名 (每行一位)</label>
          <textarea value={csvData} onChange={e => setCsvData(e.target.value)} rows={4} className="w-full border p-2 rounded-lg mb-4" placeholder="S101,王小明" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowImport(false)}>取消</Button>
            <Button onClick={handleImport}>匯入</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
            <Avatar src={s.avatar_url} alt={s.name} size="md" />
            <div>
              <div className="font-bold">{s.name}</div>
              <div className="text-xs text-gray-500 font-mono">{s.username}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Fix: Implemented missing CourseDetail component
const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'attendance' | 'gps' | 'buzzer' | 'students' | 'random'>('attendance');
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
       <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/teacher')}><Home className="w-4 h-4"/></Button>
          <h1 className="text-2xl font-bold">課程管理</h1>
       </div>

       <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock className="w-4 h-4"/>} label="一般點名" />
          <TabButton active={activeTab === 'gps'} onClick={() => setActiveTab('gps')} icon={<MapPin className="w-4 h-4"/>} label="GPS點名" />
          <TabButton active={activeTab === 'buzzer'} onClick={() => setActiveTab('buzzer')} icon={<Zap className="w-4 h-4"/>} label="搶答器" />
          <TabButton active={activeTab === 'random'} onClick={() => setActiveTab('random')} icon={<RefreshCw className="w-4 h-4"/>} label="隨機抽人" />
          <TabButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users className="w-4 h-4"/>} label="學生名單" />
       </div>

       <Card>
          {activeTab === 'attendance' && <AttendancePanel courseId={id} type={RollcallType.IMMEDIATE} />}
          {activeTab === 'gps' && <AttendancePanel courseId={id} type={RollcallType.GPS} />}
          {activeTab === 'buzzer' && <BuzzerPanel courseId={id} />}
          {activeTab === 'random' && <RandomPickPanel courseId={id} />}
          {activeTab === 'students' && <StudentListPanel courseId={id} />}
       </Card>
    </div>
  );
};

// Fix: Implemented missing UserManagement component
const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [csvData, setCsvData] = useState('');
  const [role, setRole] = useState<Role>(Role.STUDENT);

  const loadData = async () => {
    setUsers(await api.getAllUsers());
    setGroups(await api.getStudentGroups());
  };

  useEffect(() => { loadData(); }, []);

  const handleBatchCreate = async () => {
    await api.batchCreateUsers(csvData, role);
    setCsvData('');
    loadData();
  };

  const handleAddGroup = async () => {
    if (!newGroupName) return;
    const newGroups = [...groups, newGroupName];
    await api.saveStudentGroups(newGroups);
    setGroups(newGroups);
    setNewGroupName('');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/teacher"><Button variant="outline"><Home className="w-4 h-4"/></Button></Link>
        <h1 className="text-2xl font-bold">帳號與群組管理</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <h3 className="font-bold mb-4 flex items-center gap-2"><Settings className="w-4 h-4"/> 匯入帳號</h3>
            <select value={role} onChange={e => setRole(e.target.value as Role)} className="w-full border p-2 rounded-lg mb-4">
              <option value={Role.STUDENT}>學生 (Student)</option>
              <option value={Role.TEACHER}>老師 (Teacher)</option>
            </select>
            <textarea value={csvData} onChange={e => setCsvData(e.target.value)} rows={5} className="w-full border p-2 rounded-lg mb-4" placeholder="帳號,姓名,密碼(可選)" />
            <Button className="w-full" onClick={handleBatchCreate}>批次建立</Button>
          </Card>

          <Card>
            <h3 className="font-bold mb-4">名單群組管理</h3>
            <div className="flex gap-2 mb-4">
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="flex-1 border p-2 rounded-lg" placeholder="群組名稱" />
              <Button onClick={handleAddGroup}><Plus className="w-4 h-4"/></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {groups.map(g => (
                <span key={g} className="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  {g} <button onClick={async () => {
                    const next = groups.filter(x => x !== g);
                    await api.saveStudentGroups(next);
                    setGroups(next);
                  }} className="text-red-500 hover:text-red-700">×</button>
                </span>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Users className="w-4 h-4"/> 使用者列表</h3>
            <div className="overflow-y-auto flex-1 border rounded-lg">
              <table className="w-full text-left">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-3 text-sm">身分</th>
                    <th className="p-3 text-sm">姓名</th>
                    <th className="p-3 text-sm">帳號</th>
                    <th className="p-3 text-sm">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="p-3 text-sm">{u.role === Role.TEACHER ? '👨‍🏫 老師' : '🎓 學生'}</td>
                      <td className="p-3 text-sm font-bold">{u.name}</td>
                      <td className="p-3 text-sm font-mono text-gray-500">{u.username}</td>
                      <td className="p-3 text-sm">
                        <Button variant="danger" className="p-1" onClick={async () => {
                          if (confirm('確定刪除？')) {
                            await api.deleteUser(u.id);
                            loadData();
                          }
                        }}><Trash2 className="w-4 h-4"/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default function TeacherViews() {
  return (
    <Routes>
      <Route path="/" element={<TeacherDashboardHome />} />
      <Route path="/course/:id" element={<CourseDetail />} />
      <Route path="/users" element={<UserManagement />} />
    </Routes>
  );
}
