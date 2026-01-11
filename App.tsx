
import React, { useState, useEffect, createContext, useContext, PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, Role } from './types';
import { api } from './services/api';
import Login from './pages/Login';
import TeacherDashboard from './pages/TeacherViews';
import StudentDashboard from './pages/StudentViews';
import { Loader2 } from 'lucide-react';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';

interface AuthContextType {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const ProtectedRoute = ({ children, requiredRole }: PropsWithChildren<{ requiredRole?: Role }>) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (requiredRole && user.role !== requiredRole) {
      return <Navigate to={user.role === Role.TEACHER ? '/teacher' : '/student'} replace />;
  }
  return <>{children}</>;
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (u: User) => setUser(u);
  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin w-10 h-10 text-blue-500 mb-4"/>
      <p className="text-gray-500 font-medium animate-pulse">連線到雲端資料庫...</p>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, login: handleLogin, logout: handleLogout }}>
      <HashRouter>
        <div className="min-h-screen bg-gray-50 font-sans">
          <Routes>
            <Route path="/" element={!user ? <Login /> : <Navigate to={user.role === Role.TEACHER ? "/teacher" : "/student"} />} />
            <Route path="/teacher/*" element={<ProtectedRoute requiredRole={Role.TEACHER}><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/student/*" element={<ProtectedRoute requiredRole={Role.STUDENT}><StudentDashboard /></ProtectedRoute>} />
          </Routes>
        </div>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export default App;
