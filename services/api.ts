
import { 
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, 
  deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, 
  limit, Timestamp 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  User, Role, Course, CourseStudent, Rollcall, RollcallRecord, 
  AnswerBuzz, RollcallType, AttendanceStatus, LoginResponse 
} from '../types';

// Helper to transform usernames to email for Firebase Auth
const toEmail = (username: string) => `${username.toLowerCase()}@weiyi.sys`;

export const api = {
  // --- AUTH ---
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const userCredential = await signInWithEmailAndPassword(auth, toEmail(username), password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (!userDoc.exists()) {
      throw new Error('使用者資料不存在於資料庫中');
    }
    
    return { 
      token: await userCredential.user.getIdToken(), 
      user: { id: userCredential.user.uid, ...userDoc.data() } as User 
    };
  },

  getCurrentUser: (): Promise<User | null> => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            resolve({ id: firebaseUser.uid, ...userDoc.data() } as User);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  },

  logout: async () => {
    await signOut(auth);
  },

  // --- USER MANAGEMENT ---
  getAllUsers: async (): Promise<User[]> => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
  },

  createUser: async (userData: Partial<User> & { password_hash: string }): Promise<User> => {
    // 1. Create in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      toEmail(userData.username!), 
      userData.password_hash
    );
    
    const newUser: Partial<User> = {
      role: userData.role || Role.STUDENT,
      name: userData.name || 'Unknown',
      username: userData.username || 'unknown',
      avatar_url: userData.avatar_url || '',
      group: userData.group || '預設列表',
      created_at: new Date().toISOString(),
    };

    // 2. Create in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
    return { id: userCredential.user.uid, ...newUser } as User;
  },

  batchCreateUsers: async (csvData: string, role: Role) => {
    const lines = csvData.split('\n').filter(l => l.trim() !== '');
    let count = 0;
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      const username = parts[0];
      const name = parts[1];
      const password = parts[2] || (role === Role.TEACHER ? '1234' : '0000');
      
      if (!username || !name) continue;
      try {
        await api.createUser({ 
          username, 
          name, 
          role, 
          password_hash: password 
        });
        count++;
      } catch (e) {
        console.error(`Error creating user ${username}:`, e);
      }
    }
    return count;
  },

  deleteUser: async (userId: string) => {
    // Note: Deleting from Auth requires admin SDK, here we just remove from Firestore
    await deleteDoc(doc(db, 'users', userId));
  },

  updateUserGroup: async (userId: string, newGroup: string) => {
    await updateDoc(doc(db, 'users', userId), { group: newGroup });
  },

  getStudentGroups: async (): Promise<string[]> => {
    const docSnap = await getDoc(doc(db, 'settings', 'groups'));
    if (docSnap.exists()) {
      return docSnap.data().list;
    }
    return ['預設列表'];
  },

  saveStudentGroups: async (groups: string[]) => {
    await setDoc(doc(db, 'settings', 'groups'), { list: groups });
  },

  // --- COURSE MANAGEMENT ---
  getCourses: async (teacherId: string): Promise<Course[]> => {
    const q = query(collection(db, 'courses'), where('teacher_id', '==', teacherId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Course));
  },

  createCourse: async (teacherId: string, name: string): Promise<Course> => {
    const docRef = await addDoc(collection(db, 'courses'), {
      teacher_id: teacherId,
      name,
      created_at: new Date().toISOString()
    });
    return { id: docRef.id, teacher_id: teacherId, name, created_at: new Date().toISOString() };
  },

  deleteCourse: async (courseId: string) => {
    await deleteDoc(doc(db, 'courses', courseId));
  },

  getCourseStudents: async (courseId: string): Promise<User[]> => {
    const q = query(collection(db, 'course_students'), where('course_id', '==', courseId));
    const links = await getDocs(q);
    const studentIds = links.docs.map(d => d.data().student_id);
    if (studentIds.length === 0) return [];

    const usersRef = collection(db, 'users');
    const studentDocs = await getDocs(query(usersRef, where('__name__', 'in', studentIds.slice(0, 10)))); // Firestore in limit is 10
    return studentDocs.docs.map(d => ({ id: d.id, ...d.data() } as User));
  },

  importStudents: async (courseId: string, csvData: string) => {
    const lines = csvData.split('\n').filter(l => l.trim() !== '');
    let linkedCount = 0;

    for (const line of lines) {
      const [username, name] = line.split(',').map(s => s.trim());
      if (!username) continue;

      const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
      const userSnap = await getDocs(q);
      let studentId = '';

      if (userSnap.empty) {
        const newUser = await api.createUser({ username, name, role: Role.STUDENT, password_hash: '1234' });
        studentId = newUser.id;
      } else {
        studentId = userSnap.docs[0].id;
      }

      const linkCheck = query(collection(db, 'course_students'), 
        where('course_id', '==', courseId), 
        where('student_id', '==', studentId)
      );
      const linkSnap = await getDocs(linkCheck);
      
      if (linkSnap.empty) {
        await addDoc(collection(db, 'course_students'), { course_id: courseId, student_id: studentId });
        linkedCount++;
      }
    }
    return { imported: lines.length, linked: linkedCount };
  },

  getStudentCourses: async (studentId: string): Promise<Course[]> => {
    const q = query(collection(db, 'course_students'), where('student_id', '==', studentId));
    const links = await getDocs(q);
    const courseIds = links.docs.map(d => d.data().course_id);
    if (courseIds.length === 0) return [];

    const coursesRef = collection(db, 'courses');
    const courseDocs = await getDocs(query(coursesRef, where('__name__', 'in', courseIds.slice(0, 10))));
    return courseDocs.docs.map(d => ({ id: d.id, ...d.data() } as Course));
  },

  // --- ROLLCALL ---
  startRollcall: async (courseId: string, type: RollcallType, durationMinutes: number, lat?: number, lng?: number) => {
    const activeQ = query(collection(db, 'rollcalls'), where('course_id', '==', courseId), where('end_time', '==', null));
    const activeSnaps = await getDocs(activeQ);
    for (const d of activeSnaps.docs) {
      await updateDoc(doc(db, 'rollcalls', d.id), { end_time: Date.now() });
    }

    const docRef = await addDoc(collection(db, 'rollcalls'), {
      course_id: courseId,
      type,
      start_time: Date.now(),
      end_time: null,
      duration_minutes: durationMinutes,
      target_lat: lat || null,
      target_lng: lng || null,
      created_at: new Date().toISOString(),
    });
    return { id: docRef.id, course_id: courseId, type, start_time: Date.now(), end_time: null, duration_minutes: durationMinutes };
  },

  stopRollcall: async (rollcallId: string) => {
    await updateDoc(doc(db, 'rollcalls', rollcallId), { end_time: Date.now() });
  },

  // Real-time rollcall listener
  subscribeActiveRollcall: (courseId: string, callback: (rc: Rollcall | null) => void) => {
    const q = query(
      collection(db, 'rollcalls'), 
      where('course_id', '==', courseId), 
      where('end_time', '==', null),
      limit(1)
    );
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) callback(null);
      else callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Rollcall);
    });
  },

  checkIn: async (studentId: string, rollcallId: string, lat?: number, lng?: number) => {
    const checkQ = query(collection(db, 'records'), where('rollcall_id', '==', rollcallId), where('student_id', '==', studentId));
    const existing = await getDocs(checkQ);
    if (!existing.empty) return { status: 'already_checked_in' };

    const rcDoc = await getDoc(doc(db, 'rollcalls', rollcallId));
    const rc = rcDoc.data() as Rollcall;
    const elapsedMinutes = (Date.now() - rc.start_time) / 1000 / 60;
    const status = elapsedMinutes > rc.duration_minutes ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

    const newRecord = {
      rollcall_id: rollcallId,
      student_id: studentId,
      status,
      time: new Date().toISOString(),
      gps_lat: lat || null,
      gps_lng: lng || null
    };

    await addDoc(collection(db, 'records'), newRecord);
    return newRecord;
  },

  subscribeRollcallRecords: (rollcallId: string, callback: (records: RollcallRecord[]) => void) => {
    const q = query(collection(db, 'records'), where('rollcall_id', '==', rollcallId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RollcallRecord)));
    });
  },

  getCourseRollcalls: async (courseId: string) => {
    const q = query(collection(db, 'rollcalls'), where('course_id', '==', courseId), orderBy('start_time', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  updateStudentAttendance: async (rollcallId: string, studentId: string, status: AttendanceStatus) => {
    const q = query(collection(db, 'records'), where('rollcall_id', '==', rollcallId), where('student_id', '==', studentId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(doc(db, 'records', snap.docs[0].id), { status });
    } else {
      await addDoc(collection(db, 'records'), {
        rollcall_id: rollcallId,
        student_id: studentId,
        status,
        time: new Date().toISOString()
      });
    }
  },

  // --- BUZZER ---
  startBuzzer: async (courseId: string) => {
    const activeQ = query(collection(db, 'buzzers'), where('course_id', '==', courseId), where('end_time', '==', null));
    const activeSnaps = await getDocs(activeQ);
    for (const d of activeSnaps.docs) {
      await updateDoc(doc(db, 'buzzers', d.id), { end_time: Date.now() });
    }

    return await addDoc(collection(db, 'buzzers'), {
      course_id: courseId,
      start_time: Date.now(),
      end_time: null,
      winner_student_id: null
    });
  },

  subscribeBuzzer: (courseId: string, callback: (buzzer: AnswerBuzz | null) => void) => {
    const q = query(collection(db, 'buzzers'), where('course_id', '==', courseId), orderBy('start_time', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) callback(null);
      else callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AnswerBuzz);
    });
  },

  buzz: async (studentId: string, buzzerId: string) => {
    const buzzerRef = doc(db, 'buzzers', buzzerId);
    const snap = await getDoc(buzzerRef);
    const data = snap.data();
    if (data?.winner_student_id || data?.end_time) return { win: false };
    
    await updateDoc(buzzerRef, {
      winner_student_id: studentId,
      end_time: Date.now()
    });
    return { win: true };
  },

  // --- MISC ---
  randomPick: async (courseId: string): Promise<User | null> => {
    const students = await api.getCourseStudents(courseId);
    if (students.length === 0) return null;
    return students[Math.floor(Math.random() * students.length)];
  },

  updateAvatar: async (userId: string, url: string) => {
    await updateDoc(doc(db, 'users', userId), { avatar_url: url });
  },

  getStudentStats: async (studentId: string) => {
    const q = query(collection(db, 'records'), where('student_id', '==', studentId));
    const snap = await getDocs(q);
    const attended = snap.docs.filter(d => d.data().status !== AttendanceStatus.ABSENT).length;
    
    // Simplification: just counting total records vs attended
    return { total_rollcalls: snap.size, attended_count: attended };
  }
};
