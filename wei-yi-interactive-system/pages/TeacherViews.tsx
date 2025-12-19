
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../services/api';
import { Course, Rollcall, RollcallRecord, User, RollcallType, AttendanceStatus, AnswerBuzz, Role } from '../types';
import { Button, Card, Avatar, StatusBadge } from '../components/ui';
import { 
  LogOut, Plus, Trash2, Users, MapPin, Clock, Upload, 
  Play, StopCircle, Trophy, Zap, RefreshCw, Download, Settings, Eye, EyeOff, Key, Save, X, Edit2, Search, GripVertical
} from 'lucide-react';

// --- USER MANAGEMENT (NEW) ---
const UserManagement = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');

  // Student Import State
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState('');

  // Teacher Create State
  const [newTeacher, setNewTeacher] = useState({ name: '', username: '', password: '' });

  // Password Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Group Management State
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getAllUsers(), api.getStudentGroups()]).then(([uData, gData]) => {
      setUsers(uData);
      setGroups(gData);
      setLoading(false);
    });
  }, [refresh]);

  const handleBatchImportStudents = async () => {
    if (!importText.trim()) return;
    setLoading(true);
    try {
      const count = await api.batchCreateUsers(importText, Role.STUDENT);
      setImportResult(`成功建立 ${count} 筆學生帳號`);
      setImportText('');
      setRefresh(p => p + 1);
    } catch (e) {
      alert('匯入失敗');
    }
    setLoading(false);
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacher.username || !newTeacher.password) return;
    setLoading(true);
    try {
      await api.createUser({
        role: Role.TEACHER,
        name: newTeacher.name,
        username: newTeacher.username,
        password_hash: newTeacher.password
      });
      setNewTeacher({ name: '', username: '', password: '' });
      setRefresh(p => p + 1);
      alert('教師帳號建立成功');
    } catch (e: any) {
      alert(e.message || '建立失敗');
    }
    setLoading(false);
  };

  const handleDeleteUser = async (id: string) => {
    if(confirm('確定刪除此帳號？此操作不可回復。')) {
      await api.deleteUser(id);
      setRefresh(p => p + 1);
    }
  };

  const startEditingPassword = (user: User) => {
      setEditingUserId(user.id);
      setNewPassword('');
  };

  const cancelEditing = () => {
      setEditingUserId(null);
      setNewPassword('');
  };

  const savePassword = async (userId: string) => {
    if (!newPassword.trim()) return;
    try {
      await api.updatePassword(userId, newPassword);
      setRefresh(p => p + 1);
      setEditingUserId(null);
      alert('密碼重設成功');
    } catch(e) {
      alert('重設失敗');
    }
  };

  // Group DnD Logic
  const handleDragStart = (e: React.DragEvent, userId: string) => {
    e.dataTransfer.setData("userId", userId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    const userId = e.dataTransfer.getData("userId");
    if (!userId) return;
    
    // Optimistic Update
    setUsers(users.map(u => u.id === userId ? { ...u, group: targetGroup } : u));
    
    await api.updateUserGroup(userId, targetGroup);
    // setRefresh(p => p + 1); // No need to full refresh if optimistic works
  };

  const handleAddGroup = async () => {
    const newName = prompt("請輸入新列表名稱：");
    if (newName && !groups.includes(newName)) {
      const newGroups = [...groups, newName];
      setGroups(newGroups);
      await api.saveStudentGroups(newGroups);
    }
  };

  const handleRenameGroup = async (index: number) => {
    if (editingGroupName && groups[index] !== editingGroupName) {
      const oldName = groups[index];
      const newGroups = [...groups];
      newGroups[index] = editingGroupName;
      setGroups(newGroups);
      await api.saveStudentGroups(newGroups);
      
      // Update users in this group?
      // In a real app we might update DB. Here, users have the string stored.
      // So we need to migrate users.
      const usersToUpdate = users.filter(u => u.group === oldName);
      for(const u of usersToUpdate) {
          await api.updateUserGroup(u.id, editingGroupName);
      }
      setRefresh(p => p + 1);
    }
    setEditingGroupIndex(null);
  };

  const studentList = users.filter(u => u.role === Role.STUDENT && (search ? (u.name.includes(search) || u.username.includes(search)) : true));
  const teacherList = users.filter(u => u.role === Role.TEACHER && (search ? (u.name.includes(search) || u.username.includes(search)) : true));

  return (
    <div className="p-6 max-w-[1400px] mx-auto h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
            <Link to="/teacher" className="text-gray-500 hover:text-gray-800">← 返回儀表板</Link>
            <h1 className="text-2xl font-bold">全域帳號管理</h1>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
             <input 
                type="text" 
                placeholder="搜尋姓名或帳號..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border focus:ring-2 focus:ring-blue-500 outline-none"
             />
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-shrink-0">
        <button 
          onClick={() => setActiveTab('student')}
          className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'student' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          學生管理 (分組與拖曳)
        </button>
        <button 
          onClick={() => setActiveTab('teacher')}
          className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'teacher' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          教師管理
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border p-4">
        {activeTab === 'student' ? (
          <div className="flex flex-col h-full">
             <div className="mb-4 flex justify-between items-center flex-shrink-0">
                <div className="flex gap-2">
                   <Button size="sm" onClick={handleAddGroup}><Plus className="w-4 h-4 mr-1"/> 新增列表</Button>
                </div>
                {/* Minimal Import Form Toggle */}
                <details className="relative">
                   <summary className="cursor-pointer text-blue-600 text-sm font-bold list-none">批次匯入 ▼</summary>
                   <div className="absolute right-0 top-6 w-96 bg-white shadow-xl border rounded-lg p-4 z-50">
                        <p className="text-xs text-gray-500 mb-2">格式: 學號, 姓名, 密碼(選填)</p>
                        <textarea 
                            value={importText} onChange={e => setImportText(e.target.value)}
                            className="w-full h-32 border p-2 text-xs rounded mb-2" placeholder="S01, Name, 1234"
                        />
                        <Button size="sm" onClick={handleBatchImportStudents} className="w-full">匯入</Button>
                        <p className="text-green-600 text-xs mt-2">{importResult}</p>
                   </div>
                </details>
             </div>

             {/* Kanban Board Layout */}
             <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 pb-4">
                 {groups.map((group, gIdx) => (
                     <div 
                        key={group} 
                        className="flex-shrink-0 w-80 bg-gray-50 rounded-lg flex flex-col border max-h-full"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, group)}
                     >
                        <div className="p-3 font-bold text-gray-700 border-b flex justify-between items-center bg-gray-100 rounded-t-lg">
                           {editingGroupIndex === gIdx ? (
                               <input 
                                  autoFocus
                                  className="w-full px-1 border rounded"
                                  value={editingGroupName}
                                  onChange={e => setEditingGroupName(e.target.value)}
                                  onBlur={() => handleRenameGroup(gIdx)}
                                  onKeyDown={e => e.key === 'Enter' && handleRenameGroup(gIdx)}
                               />
                           ) : (
                               <span onClick={() => { setEditingGroupIndex(gIdx); setEditingGroupName(group); }} className="cursor-pointer hover:underline">
                                  {group} ({studentList.filter(s => (s.group || '預設列表') === group).length})
                               </span>
                           )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {studentList.filter(s => (s.group || '預設列表') === group).map(s => (
                                <div 
                                    key={s.id} 
                                    draggable 
                                    onDragStart={(e) => handleDragStart(e, s.id)}
                                    className="bg-white p-3 rounded shadow-sm border hover:shadow-md cursor-move group relative"
                                >
                                    <div className="flex justify-between items-start">
                                       <div className="flex gap-2 items-center">
                                           <Avatar src={s.avatar_url} alt={s.name} size="sm" />
                                           <div>
                                               <div className="font-bold text-sm">{s.name}</div>
                                               <div className="text-xs text-gray-500">{s.username}</div>
                                           </div>
                                       </div>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="mt-2 pt-2 border-t flex justify-end gap-2">
                                        {editingUserId === s.id ? (
                                            <div className="flex items-center gap-1 scale-90 origin-right">
                                                <input 
                                                    type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} 
                                                    className="w-20 border rounded px-1 text-xs" placeholder="新密碼"
                                                />
                                                <button onClick={() => savePassword(s.id)}><Save className="w-4 h-4 text-green-600"/></button>
                                                <button onClick={cancelEditing}><X className="w-4 h-4 text-gray-400"/></button>
                                            </div>
                                        ) : (
                                            <>
                                               <button onClick={() => startEditingPassword(s)} className="text-gray-400 hover:text-blue-500"><Key className="w-4 h-4"/></button>
                                               <button onClick={() => handleDeleteUser(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                 ))}
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-y-auto">
             <div>
                <h3 className="font-bold text-lg mb-4 text-blue-800">新增教師帳號</h3>
                <form onSubmit={handleCreateTeacher} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium mb-1">姓名</label>
                    <input type="text" value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} className="w-full border p-2 rounded" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">帳號</label>
                    <input type="text" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} className="w-full border p-2 rounded" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">密碼</label>
                    <input type="text" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} className="w-full border p-2 rounded" required />
                  </div>
                  <Button type="submit" isLoading={loading} className="w-full">建立教師</Button>
                </form>
             </div>
             <div className="border-l pl-8">
              <h3 className="font-bold text-lg mb-4">現有教師列表 ({teacherList.length})</h3>
              <div className="space-y-2">
                {teacherList.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 border rounded bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Avatar src={t.avatar_url} alt={t.name} size="sm"/>
                      <div>
                        <div className="font-bold">{t.name}</div>
                        <div className="text-xs text-gray-500">帳號: {t.username}</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                        {editingUserId === t.id ? (
                            <div className="flex items-center gap-2">
                                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-24 border rounded px-1 text-sm"/>
                                <button onClick={() => savePassword(t.id)}><Save className="w-4 h-4 text-green-600"/></button>
                                <button onClick={cancelEditing}><X className="w-4 h-4 text-gray-400"/></button>
                            </div>
                        ) : (
                            <>
                                <button onClick={() => startEditingPassword(t)} className="text-gray-400 hover:text-blue-500"><Key className="w-4 h-4"/></button>
                                {t.username !== 'admin' && (
                                   <button onClick={() => handleDeleteUser(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                                )}
                            </>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- DASHBOARD ---
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

  const handleDelete = async (id: string) => {
      if(confirm('確定刪除課程？這將移除課程內所有點名紀錄。')) {
          await api.deleteCourse(id);
          setCourses(courses.filter(c => c.id !== id));
      }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">老師管理後台</h1>
          <p className="text-gray-500">歡迎回來，{user?.name}</p>
        </div>
        <div className="flex gap-2">
           <Link to="/teacher/users">
              <Button variant="secondary"><Settings className="w-4 h-4 mr-2"/> 帳號管理</Button>
           </Link>
           <Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2"/> 登出</Button>
        </div>
      </div>

      <Card className="mb-8">
        <form onSubmit={handleCreate} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">建立新課程</label>
            <input 
              type="text" 
              value={newCourseName}
              onChange={e => setNewCourseName(e.target.value)}
              placeholder="例如：112學年度 - 程式設計"
              className="w-full border p-2 rounded-lg"
              required
            />
          </div>
          <Button type="submit"><Plus className="w-4 h-4 mr-2"/> 新增課程</Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map(course => (
          <div key={course.id} className="bg-white rounded-xl shadow hover:shadow-md transition-shadow p-6 border border-gray-100 flex flex-col justify-between h-48 cursor-pointer group" onClick={() => navigate(`/teacher/course/${course.id}`)}>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">{course.name}</h3>
              <p className="text-sm text-gray-400 italic">點擊進入課程</p>
            </div>
            <div className="flex justify-end mt-4">
               <button onClick={(e) => { e.stopPropagation(); handleDelete(course.id); }} className="text-gray-400 hover:text-red-500 p-2 z-10" title="刪除課程">
                 <Trash2 className="w-5 h-5" />
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- COURSE DETAIL ---
const CourseDetail = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'attendance' | 'gps' | 'random' | 'buzzer' | 'import'>('attendance');
  const [showId, setShowId] = useState(false);
  
  if (!id) return null;

  return (
    <div className="min-h-screen flex flex-col">
       <header className="bg-white shadow-sm border-b p-4 flex items-center justify-between sticky top-0 z-10">
         <div className="flex items-center gap-4">
           <Link to="/teacher" className="text-gray-500 hover:text-gray-800 font-medium">← 返回列表</Link>
           <div className="h-6 w-px bg-gray-300"></div>
           <div className="flex items-center gap-2">
             <h1 className="font-bold text-lg text-gray-800">課程代碼:</h1>
             <span className={`font-mono bg-gray-100 px-2 rounded min-w-[100px] text-center ${showId ? 'text-black' : 'text-transparent bg-gray-200 select-none'}`}>
                {showId ? id : '••••••••'}
             </span>
             <button onClick={() => setShowId(!showId)} className="text-gray-400 hover:text-gray-600 p-1">
               {showId ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
             </button>
           </div>
         </div>
       </header>

       <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
            <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock/>}>即時點名</TabButton>
            <TabButton active={activeTab === 'gps'} onClick={() => setActiveTab('gps')} icon={<MapPin/>}>GPS 點名</TabButton>
            <TabButton active={activeTab === 'random'} onClick={() => setActiveTab('random')} icon={<Users/>}>隨機抽點</TabButton>
            <TabButton active={activeTab === 'buzzer'} onClick={() => setActiveTab('buzzer')} icon={<Zap/>}>搶答活動</TabButton>
            <TabButton active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={<Upload/>}>課程名單</TabButton>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border min-h-[500px] p-6">
            {activeTab === 'attendance' && <AttendancePanel courseId={id} type={RollcallType.IMMEDIATE} />}
            {activeTab === 'gps' && <AttendancePanel courseId={id} type={RollcallType.GPS} />}
            {activeTab === 'random' && <RandomPickerPanel courseId={id} />}
            {activeTab === 'buzzer' && <BuzzerPanel courseId={id} />}
            {activeTab === 'import' && <ImportPanel courseId={id} />}
          </div>
       </main>
    </div>
  );
};

const TabButton = ({ active, onClick, children, icon }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
      active ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
    }`}
  >
    {React.cloneElement(icon, { className: "w-4 h-4" })}
    {children}
  </button>
);

// --- FEATURE PANELS ---

// Status Badge with Edit Functionality (Fixed positioning for dropdown)
const StatusEditableBadge = ({ status, onChange }: { status: string, onChange: (s: AttendanceStatus) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const getStatusColor = (s: string) => {
      switch(s) {
          case '出席': return 'bg-green-500';
          case '遲到': return 'bg-orange-500';
          case '缺席': return 'bg-red-500';
          case '請假': return 'bg-blue-500';
          default: return 'bg-gray-400';
      }
  };

  const getStatusBg = (s: string) => {
      switch(s) {
          case '出席': return 'bg-green-100 text-green-800 border-green-200';
          case '遲到': return 'bg-orange-100 text-orange-800 border-orange-200';
          case '缺席': return 'bg-red-100 text-red-800 border-red-200';
          case '請假': return 'bg-blue-100 text-blue-800 border-blue-200';
          default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
  };

  const toggleDropdown = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isOpen && buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setDropdownPos({
              top: rect.bottom + 5,
              left: rect.left
          });
      }
      setIsOpen(!isOpen);
  };

  const options = Object.values(AttendanceStatus);

  return (
    <>
        <button 
            ref={buttonRef}
            onClick={toggleDropdown}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 ${getStatusBg(status)} cursor-pointer hover:opacity-80 transition-opacity`}
        >
            <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`}></span>
            {status}
        </button>
        
        {isOpen && (
            <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)}>
                <div 
                    className="absolute bg-white border rounded-lg shadow-xl py-1 min-w-[120px] z-50 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    onClick={e => e.stopPropagation()}
                >
                    {options.map(opt => (
                        <button
                            key={opt}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                        >
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(opt)}`}></span>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        )}
    </>
  );
};

// 1. & 2. ATTENDANCE (Normal + GPS)
const AttendancePanel = ({ courseId, type }: { courseId: string, type: RollcallType }) => {
  // Mode: 'history' (default) or 'active' (detail view)
  const [viewMode, setViewMode] = useState<'history' | 'active'>('history');
  
  // History State
  const [history, setHistory] = useState<any[]>([]);

  // Active Rollcall State
  const [activeRollcall, setActiveRollcall] = useState<Rollcall | null>(null);
  const [records, setRecords] = useState<RollcallRecord[]>([]);
  const [students, setStudents] = useState<User[]>([]); // All students in course
  const [duration, setDuration] = useState(60);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const loadHistory = async () => {
      const data = await api.getCourseRollcalls(courseId);
      setHistory(data.filter(d => d.type === type));
      
      // Check if there is an active one running
      const active = await api.getActiveRollcall(courseId);
      if (active && active.type === type) {
          handleViewRollcall(active);
      }
  };

  useEffect(() => { loadHistory(); }, [courseId, type]);

  const fetchActiveStatus = async () => {
    if(!activeRollcall) return;
    setRefreshing(true);
    const data = await api.getRollcallRecords(activeRollcall.id);
    setRecords(data.records);
    setStudents(data.students);
    setRefreshing(false);
  };

  const handleViewRollcall = async (rollcall: Rollcall) => {
      setActiveRollcall(rollcall);
      setViewMode('active');
      setRefreshing(true);
      const data = await api.getRollcallRecords(rollcall.id);
      setRecords(data.records);
      setStudents(data.students);
      setRefreshing(false);
  };

  const handleDeleteRollcall = async (rollcallId: string) => {
      if(confirm('確定刪除此點名紀錄？所有學生簽到資料將一併刪除。')) {
          await api.deleteRollcall(rollcallId);
          loadHistory(); // Refresh list
      }
  };

  // Countdown Logic
  useEffect(() => {
    let interval: any;
    if (activeRollcall && viewMode === 'active' && !activeRollcall.end_time) {
      interval = setInterval(() => {
        const endTime = activeRollcall.start_time + (activeRollcall.duration_minutes * 60 * 1000);
        const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setTimeLeft(diff);
        // Refresh records periodically
        if (diff % 5 === 0 && diff > 0) { 
           fetchActiveStatus();
        }
        if (diff === 0) {
           clearInterval(interval);
        }
      }, 1000);
      // Initial set
      const endTime = activeRollcall.start_time + (activeRollcall.duration_minutes * 60 * 1000);
      setTimeLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    }
    return () => clearInterval(interval);
  }, [activeRollcall, viewMode]);

  const handleStart = async () => {
    let lat, lng;
    const safeDuration = Math.max(1, Math.min(60, duration || 1)); 

    if (type === RollcallType.GPS) {
      if (!navigator.geolocation) return alert('瀏覽器不支援 GPS');
      navigator.geolocation.getCurrentPosition(async (pos) => {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        const newRc = await api.startRollcall(courseId, type, safeDuration, lat, lng);
        handleViewRollcall(newRc);
      });
    } else {
      const newRc = await api.startRollcall(courseId, type, safeDuration);
      handleViewRollcall(newRc);
    }
  };

  const handleStop = async () => {
    if (activeRollcall) {
      await api.stopRollcall(activeRollcall.id);
      // Update local state to reflect stopped
      setActiveRollcall({ ...activeRollcall, end_time: Date.now() });
    }
  };

  const handleStatusChange = async (studentId: string, newStatus: AttendanceStatus) => {
      if (!activeRollcall) return;
      await api.updateStudentAttendance(activeRollcall.id, studentId, newStatus);
      // Refresh local records
      const data = await api.getRollcallRecords(activeRollcall.id);
      setRecords(data.records);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const checkedInCount = records.filter(r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE || r.status === AttendanceStatus.EARLY_LEAVE).length;
  const totalStudents = students.length;

  const exportCSV = () => {
      const header = "學號,姓名,大頭照URL,狀態,回傳時間,GPS\n";
      const rows = students.map(s => {
          const rec = records.find(r => r.student_id === s.id);
          const status = rec ? rec.status : (activeRollcall ? '未到' : '缺席');
          const time = rec ? new Date(rec.time).toLocaleTimeString() : '-';
          const gps = rec?.gps_lat ? `${rec.gps_lat};${rec.gps_lng}` : '-';
          return `${s.username},${s.name},${s.avatar_url},${status},${time},${gps}`;
      }).join('\n');
      
      const blob = new Blob(["\uFEFF" + header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_${courseId}_${new Date().toISOString()}.csv`;
      link.click();
  };

  const displayList = students.map((s, index) => {
    const rec = records.find(r => r.student_id === s.id);
    return { ...s, record: rec, index: index + 1 };
  });

  // --- HISTORY VIEW ---
  if (viewMode === 'history') {
      return (
          <div>
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {type === RollcallType.GPS ? <MapPin className="text-blue-500"/> : <Clock className="text-blue-500"/>}
                    歷史點名紀錄
                  </h2>
                  <Button onClick={() => setViewMode('active')}>+ 發起新點名</Button>
              </div>
              
              <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b text-gray-600 text-sm">
                            <th className="p-4">日期</th>
                            <th className="p-4">時間</th>
                            <th className="p-4">類型</th>
                            <th className="p-4 text-center">出席人數 / 總人數</th>
                            <th className="p-4">狀態</th>
                            <th className="p-4 w-20">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {history.map(h => (
                            <tr key={h.id} className="hover:bg-gray-50 cursor-pointer group" onClick={() => handleViewRollcall(h)}>
                                <td className="p-4">{new Date(h.start_time).toLocaleDateString()}</td>
                                <td className="p-4">{new Date(h.start_time).toLocaleTimeString()}</td>
                                <td className="p-4">{h.type === RollcallType.GPS ? 'GPS 點名' : '一般點名'}</td>
                                <td className="p-4 text-center">
                                    <span className="font-bold text-green-600">{h.present_count}</span>
                                    <span className="text-gray-400"> / {h.total_students}</span>
                                </td>
                                <td className="p-4">
                                    {h.end_time ? <span className="text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded">已結束</span> : <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded animate-pulse">進行中</span>}
                                </td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRollcall(h.id); }} 
                                        className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="刪除紀錄"
                                    >
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">尚無歷史紀錄</td></tr>}
                    </tbody>
                </table>
              </div>
          </div>
      );
  }

  // --- ACTIVE / DETAIL VIEW ---
  return (
    <div className="space-y-6">
      <div className="mb-4">
         <button onClick={() => { loadHistory(); setViewMode('history'); setActiveRollcall(null); }} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm">
             ← 返回歷史紀錄
         </button>
      </div>

      {/* 1. Header Info Section */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
             {type === RollcallType.GPS ? <MapPin className="text-blue-500"/> : <Clock className="text-blue-500"/>}
             {activeRollcall ? new Date(activeRollcall.start_time).toLocaleString() : new Date().toLocaleDateString() + ' 點名表'}
             {activeRollcall?.end_time && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">已結束</span>}
          </h2>
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
             <span>出席: <b className="text-green-600">{records.filter(r => r.status === AttendanceStatus.PRESENT).length}</b></span>
             <span>遲到: <b className="text-orange-600">{records.filter(r => r.status === AttendanceStatus.LATE).length}</b></span>
             <span>缺席: <b className="text-red-600">{totalStudents - checkedInCount}</b></span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 md:mt-0">
           {!activeRollcall ? (
             <div className="flex items-center gap-2">
                <span className="text-sm font-medium">設定時間:</span>
                <input 
                  type="number" 
                  value={duration} 
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-16 border rounded p-1 text-center"
                />
                <span className="text-sm">分</span>
                <Button onClick={handleStart} className="ml-2"><Play className="w-4 h-4 mr-1"/> 開始點名</Button>
             </div>
           ) : (
             <div className="flex items-center gap-2">
                {!activeRollcall.end_time && (
                    <Button variant="danger" onClick={handleStop}><StopCircle className="w-4 h-4 mr-1"/> 停止點名</Button>
                )}
                <Button variant="outline" onClick={fetchActiveStatus}><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}/></Button>
             </div>
           )}
           <Button variant="secondary" onClick={exportCSV}><Download className="w-4 h-4"/></Button>
        </div>
      </div>

      {/* 2. Big Timer & Stats Section (Only if active or just finished view concept) */}
      {activeRollcall && !activeRollcall.end_time && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Timer */}
           <div className="bg-gray-800 text-white rounded-2xl p-8 flex flex-col items-center justify-center shadow-lg h-48">
              <span className="text-gray-400 font-bold tracking-widest text-sm uppercase mb-2">剩餘時間</span>
              <div className="text-7xl font-mono font-bold tracking-tight tabular-nums">
                 {formatTime(timeLeft)}
              </div>
           </div>

           {/* Live Counter */}
           <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-8 flex flex-col items-center justify-center shadow-lg h-48">
              <span className="text-blue-100 font-bold tracking-widest text-sm uppercase mb-2">已簽到人數</span>
              <div className="flex items-baseline gap-2">
                 <span className="text-7xl font-bold">{checkedInCount}</span>
                 <span className="text-3xl opacity-60">/ {totalStudents}</span>
              </div>
           </div>
        </div>
      )}

      {/* 3. Student List Table */}
      <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
             <thead>
                <tr className="bg-gray-100 border-b text-gray-600 text-sm">
                   <th className="p-4 font-semibold w-16 text-center">序號</th>
                   <th className="p-4 font-semibold w-20">照片</th>
                   <th className="p-4 font-semibold">姓名</th>
                   <th className="p-4 font-semibold">學號</th>
                   <th className="p-4 font-semibold text-center">狀態 (點擊修改)</th>
                   <th className="p-4 font-semibold text-right">回傳時間</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {displayList.map((s) => (
                   <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-center text-gray-400">{s.index}</td>
                      <td className="p-3">
                         <Avatar src={s.avatar_url} alt={s.name} size="sm"/>
                      </td>
                      <td className="p-3 font-medium text-gray-800">{s.name}</td>
                      <td className="p-3 text-gray-500 font-mono text-sm">{s.username}</td>
                      <td className="p-3 text-center">
                         {s.record ? (
                            <StatusEditableBadge status={s.record.status} onChange={(newStatus) => handleStatusChange(s.id, newStatus)}/>
                         ) : (
                            <StatusEditableBadge status={activeRollcall?.end_time ? "缺席" : "未到"} onChange={(newStatus) => handleStatusChange(s.id, newStatus)}/>
                         )}
                      </td>
                      <td className="p-3 text-right text-sm text-gray-500 font-mono">
                         {s.record ? new Date(s.record.time).toLocaleTimeString() : '-'}
                      </td>
                   </tr>
                ))}
                {displayList.length === 0 && (
                   <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">目前無學生資料</td>
                   </tr>
                )}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 3. RANDOM PICKER
const RandomPickerPanel = ({ courseId }: { courseId: string }) => {
  const [picked, setPicked] = useState<User | null>(null);
  const [animating, setAnimating] = useState(false);

  const handlePick = async () => {
    setAnimating(true);
    setPicked(null);
    // Fake shuffle animation
    await new Promise(r => setTimeout(r, 1000));
    const user = await api.randomPick(courseId);
    setPicked(user);
    setAnimating(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
       <div className="mb-8 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl relative overflow-hidden border-4 border-white">
          {animating ? (
             <div className="text-white text-4xl font-bold animate-pulse">???</div>
          ) : picked ? (
             // Avatar logic handles fallback internally, but here we want large display
             <img src={picked.avatar_url || ''} 
                  onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                  alt="Winner" 
                  className={`w-full h-full object-cover ${!picked.avatar_url && 'hidden'}`} 
             />
          ) : (
             <Users className="w-20 h-20 text-white opacity-50" />
          )}
          
          {/* Fallback for no avatar url or error */}
          {picked && (!picked.avatar_url) && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-300">
                <Users className="w-24 h-24 text-gray-500" />
             </div>
          )}
       </div>
       
       {picked && !animating && (
         <div className="text-center mb-8 animate-bounce-in">
           <h2 className="text-3xl font-bold text-gray-800">{picked.name}</h2>
           <p className="text-xl text-gray-500">{picked.username}</p>
         </div>
       )}

       <Button size="lg" onClick={handlePick} disabled={animating} className="px-12 py-4 text-lg shadow-lg">
         {animating ? '抽籤中...' : '隨機抽點'}
       </Button>
    </div>
  );
};

// 4. BUZZER
const BuzzerPanel = ({ courseId }: { courseId: string }) => {
  const [buzzer, setBuzzer] = useState<AnswerBuzz | undefined>(undefined);
  const [winner, setWinner] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
     const b = await api.getBuzzerStatus(courseId);
     setBuzzer(b);
     if (b?.winner_student_id) {
        // fetch winner details (hack: usually backend expands this)
        const allUsers = JSON.parse(localStorage.getItem('wy_users') || '[]');
        const w = allUsers.find((u:User) => u.id === b.winner_student_id);
        setWinner(w || null);
     } else {
        setWinner(null);
     }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000); // Polling for winner
    return () => clearInterval(interval);
  }, [courseId]);

  const startBuzzer = async () => {
     setLoading(true);
     await api.startBuzzer(courseId);
     await refresh();
     setLoading(false);
  };

  return (
    <div className="flex flex-col items-center py-12 text-center">
       <div className="bg-yellow-100 p-6 rounded-full mb-6">
         <Zap className="w-12 h-12 text-yellow-600" />
       </div>
       
       {!buzzer || (buzzer.end_time && buzzer.winner_student_id) ? (
          <>
            <h2 className="text-2xl font-bold mb-2">搶答準備</h2>
            <p className="text-gray-500 mb-8">按下開始後，學生端將出現搶答按鈕</p>
            <Button onClick={startBuzzer} disabled={loading} className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 text-lg">
               開始搶答
            </Button>
            
            {winner && (
               <div className="mt-12 bg-yellow-50 border border-yellow-200 p-8 rounded-2xl shadow-lg animate-fade-in-up">
                  <p className="text-yellow-800 font-bold uppercase tracking-wider mb-4">🏆 獲勝者</p>
                  <div className="flex flex-col items-center">
                     <Avatar src={winner.avatar_url} alt={winner.name} size="xl" />
                     <h3 className="text-2xl font-bold mt-4">{winner.name}</h3>
                     <p className="text-gray-600">{winner.username}</p>
                  </div>
               </div>
            )}
          </>
       ) : (
          <div className="animate-pulse">
             <h2 className="text-3xl font-bold text-blue-600 mb-2">搶答進行中！</h2>
             <p className="text-gray-500">等待學生按下按鈕...</p>
             <div className="mt-8 text-6xl">⏳</div>
          </div>
       )}
    </div>
  );
};

// 5. IMPORT/STUDENT LIST PANEL (Merged)
const StudentHistoryModal = ({ student, history, onClose }: any) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                         <Avatar src={student.avatar_url} alt={student.name} size="sm"/>
                         {student.name} 的出缺席紀錄
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500"/></button>
                </div>
                <div className="p-0 max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                                <th className="p-3">日期</th>
                                <th className="p-3">類型</th>
                                <th className="p-3 text-right">狀態</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {history.map((h: any) => (
                                <tr key={h.rollcall.id}>
                                    <td className="p-3 text-sm">{new Date(h.rollcall.start_time).toLocaleString()}</td>
                                    <td className="p-3 text-sm">{h.rollcall.type === 'gps' ? 'GPS' : '一般'}</td>
                                    <td className="p-3 text-right"><StatusBadge status={h.status} /></td>
                                </tr>
                            ))}
                            {history.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">尚無紀錄</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 border-t text-right bg-gray-50">
                    <Button size="sm" onClick={onClose}>關閉</Button>
                </div>
            </div>
        </div>
    );
};

const ImportPanel = ({ courseId }: { courseId: string }) => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<User[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // History Modal State
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const fetchStudents = async () => {
      const list = await api.getCourseStudents(courseId);
      setStudents(list);
  };

  useEffect(() => { fetchStudents(); }, [courseId]);

  const handleImport = async () => {
    setLoading(true);
    try {
       const res = await api.importStudents(courseId, input);
       setResult(`成功匯入/更新 ${res.imported} 位學生，加入課程 ${res.linked} 位。`);
       setInput('');
       fetchStudents();
       setTimeout(() => setShowAddForm(false), 2000);
    } catch (e) {
       setResult('匯入失敗');
    }
    setLoading(false);
  };

  const handleStudentClick = async (student: User) => {
      setLoading(true);
      const hist = await api.getStudentHistoryInCourse(courseId, student.id);
      setHistory(hist);
      setSelectedStudent(student);
      setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
       <div className="flex justify-between items-center mb-6">
           <h3 className="font-bold text-lg">課程學生名單 ({students.length})</h3>
           <Button onClick={() => setShowAddForm(!showAddForm)}>
               {showAddForm ? '取消新增' : '+ 新增學生'}
           </Button>
       </div>

       {showAddForm && (
           <div className="mb-8 bg-blue-50 p-6 rounded-xl border border-blue-100">
               <h4 className="font-bold text-blue-800 mb-2">將現有/新學生加入此課程</h4>
               <p className="text-xs text-blue-600 mb-4">格式: 學號, 姓名</p>
               <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="w-full h-32 border rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                    placeholder="S001, 王小明"
                ></textarea>
                <div className="flex justify-between items-center">
                    <span className="text-green-600 font-bold text-sm">{result}</span>
                    <Button onClick={handleImport} isLoading={loading} disabled={!input.trim()}>
                        <Upload className="w-4 h-4 mr-2"/> 加入課程
                    </Button>
                </div>
           </div>
       )}

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {students.map(s => (
               <div 
                  key={s.id} 
                  onClick={() => handleStudentClick(s)}
                  className="flex items-center gap-4 p-4 bg-white border rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-shadow"
               >
                   <Avatar src={s.avatar_url} alt={s.name} size="md" />
                   <div>
                       <div className="font-bold text-gray-800">{s.name}</div>
                       <div className="text-sm text-gray-500 font-mono">{s.username}</div>
                   </div>
               </div>
           ))}
           {students.length === 0 && <p className="text-gray-400 text-center col-span-2 py-8">本課程尚無學生</p>}
       </div>

       {selectedStudent && (
           <StudentHistoryModal 
              student={selectedStudent} 
              history={history} 
              onClose={() => setSelectedStudent(null)} 
           />
       )}
    </div>
  );
};

// --- ROUTER WRAPPER ---
export default function TeacherViews() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<TeacherDashboardHome />} />
        <Route path="/course/:id" element={<CourseDetail />} />
        <Route path="/users" element={<UserManagement />} />
      </Routes>
    </div>
  );
}
