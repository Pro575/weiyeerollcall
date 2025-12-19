import React, { useState, useEffect, createContext, useContext, PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { User, Role } from './types';
import { api } from './services/api';
import Login from './pages/Login';
import TeacherDashboard from './pages/TeacherViews';
import StudentDashboard from './pages/StudentViews';
import { Loader2 } from 'lucide-react';

// --- CONTEXT ---
interface AuthContextType {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

// --- PROTECTED ROUTE ---
const ProtectedRoute = ({ children, requiredRole }: PropsWithChildren<{ requiredRole?: Role }>) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (requiredRole && user.role !== requiredRole) {
      return <Navigate to={user.role === Role.TEACHER ? '/teacher' : '/student'} replace />;
  }
  return <>{children}</>;
};

// --- APP ROOT ---
const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = api.getCurrentUser();
    if (currentUser) setUser(currentUser);
    setLoading(false);
  }, []);

  const handleLogin = (u: User) => setUser(u);
  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-500"/></div>;

  return (
    <AuthContext.Provider value={{ user, login: handleLogin, logout: handleLogout }}>
      <HashRouter>
        <div className="min-h-screen bg-gray-50 font-sans">
          <Routes>
            <Route path="/" element={!user ? <Login /> : <Navigate to={user.role === Role.TEACHER ? "/teacher" : "/student"} />} />
            
            {/* Teacher Routes */}
            <Route path="/teacher/*" element={
              <ProtectedRoute requiredRole={Role.TEACHER}>
                <TeacherDashboard />
              </ProtectedRoute>
            } />

            {/* Student Routes */}
            <Route path="/student/*" element={
              <ProtectedRoute requiredRole={Role.STUDENT}>
                <StudentDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export default App;