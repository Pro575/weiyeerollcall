
import { 
  User, Role, Course, CourseStudent, Rollcall, RollcallRecord, 
  AnswerBuzz, RollcallType, AttendanceStatus, LoginResponse 
} from '../types';

// --- MOCK DATABASE (LocalStorage) ---

const DB_KEYS = {
  USERS: 'wy_users',
  COURSES: 'wy_courses',
  COURSE_STUDENTS: 'wy_course_students',
  ROLLCALLS: 'wy_rollcalls',
  RECORDS: 'wy_records',
  BUZZERS: 'wy_buzzers',
  CURRENT_USER: 'wy_current_user',
  STUDENT_GROUPS: 'wy_student_groups', // New key for group names
};

// Initial Data Seeding
const seedData = () => {
  if (!localStorage.getItem(DB_KEYS.USERS)) {
    const adminTeacher: User = {
      id: 't1',
      role: Role.TEACHER,
      name: '王老師',
      username: 'admin',
      password_hash: 'admin',
      avatar_url: 'https://picsum.photos/200',
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify([adminTeacher]));
    localStorage.setItem(DB_KEYS.COURSES, JSON.stringify([]));
    localStorage.setItem(DB_KEYS.COURSE_STUDENTS, JSON.stringify([]));
    localStorage.setItem(DB_KEYS.ROLLCALLS, JSON.stringify([]));
    localStorage.setItem(DB_KEYS.RECORDS, JSON.stringify([]));
    localStorage.setItem(DB_KEYS.BUZZERS, JSON.stringify([]));
    localStorage.setItem(DB_KEYS.STUDENT_GROUPS, JSON.stringify(['預設列表']));
  }
};

seedData();

// Helpers
const getList = <T>(key: string): T[] => JSON.parse(localStorage.getItem(key) || '[]');
const saveList = <T>(key: string, list: T[]) => localStorage.setItem(key, JSON.stringify(list));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- API METHODS ---

export const api = {
  // 10. API Implementation

  // POST /auth/login
  login: async (username: string, password: string): Promise<LoginResponse> => {
    await delay(500);
    const users = getList<User>(DB_KEYS.USERS);
    const user = users.find(u => u.username === username && u.password_hash === password);
    
    if (!user) throw new Error('帳號或密碼錯誤');
    
    localStorage.setItem(DB_KEYS.CURRENT_USER, JSON.stringify(user));
    return { token: 'mock-jwt-token-' + user.id, user };
  },

  getCurrentUser: (): User | null => {
    const u = localStorage.getItem(DB_KEYS.CURRENT_USER);
    return u ? JSON.parse(u) : null;
  },

  logout: () => {
    localStorage.removeItem(DB_KEYS.CURRENT_USER);
  },

  // --- USER MANAGEMENT (NEW) ---
  
  // GET /users
  getAllUsers: async (): Promise<User[]> => {
    await delay(300);
    return getList<User>(DB_KEYS.USERS);
  },

  // POST /users (Create Single User)
  createUser: async (user: Partial<User>): Promise<User> => {
    await delay(300);
    const users = getList<User>(DB_KEYS.USERS);
    if (users.some(u => u.username === user.username)) {
      throw new Error('帳號已存在');
    }
    const newUser: User = {
      id: (user.role === Role.TEACHER ? 't-' : 's-') + Date.now() + Math.random().toString(36).substr(2, 5),
      role: user.role || Role.STUDENT,
      name: user.name || 'Unknown',
      username: user.username || 'unknown',
      password_hash: user.password_hash || '1234',
      avatar_url: user.avatar_url || '',
      group: user.group || '預設列表',
      created_at: new Date().toISOString(),
    };
    saveList(DB_KEYS.USERS, [...users, newUser]);
    return newUser;
  },

  // POST /users/batch (Batch Import)
  batchCreateUsers: async (csvData: string, role: Role) => {
    await delay(500);
    const lines = csvData.split('\n').filter(l => l.trim() !== '');
    const users = getList<User>(DB_KEYS.USERS);
    const newUsers: User[] = [];

    lines.forEach(line => {
      // Format: username, name, password (optional)
      const parts = line.split(',').map(s => s.trim());
      const username = parts[0];
      const name = parts[1];
      const password = parts[2] || (role === Role.TEACHER ? '1234' : '0000'); // Default pw

      if (!username || !name) return;
      if (users.some(u => u.username === username)) return; // Skip duplicate

      const newUser: User = {
        id: (role === Role.TEACHER ? 't-' : 's-') + username,
        role,
        name,
        username,
        password_hash: password,
        avatar_url: '',
        group: '預設列表',
        created_at: new Date().toISOString(),
      };
      newUsers.push(newUser);
      users.push(newUser); // Add to local check for subsequent lines
    });

    saveList(DB_KEYS.USERS, users);
    return newUsers.length;
  },

  deleteUser: async (userId: string) => {
    await delay(300);
    let users = getList<User>(DB_KEYS.USERS);
    users = users.filter(u => u.id !== userId);
    saveList(DB_KEYS.USERS, users);
    
    // Cleanup records? Optional but good practice
    // For simplicity we leave records but they won't link to a user anymore
  },

  updatePassword: async (userId: string, newPw: string) => {
    await delay(300);
    const users = getList<User>(DB_KEYS.USERS);
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].password_hash = newPw;
      saveList(DB_KEYS.USERS, users);
    } else {
      throw new Error('User not found');
    }
  },

  updateTeacherPassword: async (teacherId: string, newPw: string) => {
      return api.updatePassword(teacherId, newPw);
  },

  // Group Management
  getStudentGroups: async (): Promise<string[]> => {
      const groups = getList<string>(DB_KEYS.STUDENT_GROUPS);
      return groups.length ? groups : ['預設列表'];
  },

  saveStudentGroups: async (groups: string[]) => {
      saveList(DB_KEYS.STUDENT_GROUPS, groups);
  },

  updateUserGroup: async (userId: string, newGroup: string) => {
      const users = getList<User>(DB_KEYS.USERS);
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
          users[idx].group = newGroup;
          saveList(DB_KEYS.USERS, users);
      }
  },

  // POST /course/import-students (Legacy: Link existing users to course or create if not exist)
  importStudents: async (courseId: string, csvData: string) => {
    await delay(800);
    const lines = csvData.split('\n').filter(l => l.trim() !== '');
    const users = getList<User>(DB_KEYS.USERS);
    const courseStudents = getList<CourseStudent>(DB_KEYS.COURSE_STUDENTS);
    
    const newStudents: User[] = [];
    const newLinks: CourseStudent[] = [];

    lines.forEach(line => {
      // Format: 学號, 姓名
      const [username, name] = line.split(',').map(s => s.trim());
      if (!username || !name) return;

      let student = users.find(u => u.username === username);
      if (!student) {
        student = {
          id: 's-' + username,
          role: Role.STUDENT,
          name,
          username,
          password_hash: '1234', 
          avatar_url: '',
          group: '預設列表',
          created_at: new Date().toISOString(),
        };
        newStudents.push(student);
        users.push(student);
      }

      // Link to course if not already
      const exists = courseStudents.some(cs => cs.course_id === courseId && cs.student_id === student!.id);
      if (!exists && student) {
        newLinks.push({
          id: 'cs-' + Date.now() + Math.random(),
          course_id: courseId,
          student_id: student.id
        });
      }
    });

    saveList(DB_KEYS.USERS, users); // Save updated users list (with new ones)
    saveList(DB_KEYS.COURSE_STUDENTS, [...courseStudents, ...newLinks]);
    return { imported: newStudents.length, linked: newLinks.length };
  },

  // GET /courses/students
  getCourseStudents: async (courseId: string): Promise<User[]> => {
    await delay(300);
    const links = getList<CourseStudent>(DB_KEYS.COURSE_STUDENTS).filter(cs => cs.course_id === courseId);
    const users = getList<User>(DB_KEYS.USERS);
    return users.filter(u => links.some(l => l.student_id === u.id));
  },

  // GET /courses
  getCourses: async (teacherId: string): Promise<Course[]> => {
    await delay(300);
    const courses = getList<Course>(DB_KEYS.COURSES);
    return courses.filter(c => c.teacher_id === teacherId);
  },

  // POST /courses
  createCourse: async (teacherId: string, name: string): Promise<Course> => {
    await delay(300);
    const courses = getList<Course>(DB_KEYS.COURSES);
    const newCourse: Course = {
      id: 'c-' + Date.now(),
      teacher_id: teacherId,
      name,
      created_at: new Date().toISOString()
    };
    saveList(DB_KEYS.COURSES, [...courses, newCourse]);
    return newCourse;
  },

  deleteCourse: async (courseId: string) => {
      await delay(300);
      let courses = getList<Course>(DB_KEYS.COURSES);
      courses = courses.filter(c => c.id !== courseId);
      saveList(DB_KEYS.COURSES, courses);
  },

  // For Student: Get My Courses
  getStudentCourses: async (studentId: string): Promise<Course[]> => {
    await delay(300);
    const links = getList<CourseStudent>(DB_KEYS.COURSE_STUDENTS).filter(cs => cs.student_id === studentId);
    const allCourses = getList<Course>(DB_KEYS.COURSES);
    return allCourses.filter(c => links.some(l => l.course_id === c.id));
  },

  // Student: Update Avatar
  updateAvatar: async (userId: string, url: string) => {
    const users = getList<User>(DB_KEYS.USERS);
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].avatar_url = url;
      saveList(DB_KEYS.USERS, users);
      // Update current session if needed
      const currentUser = api.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
         currentUser.avatar_url = url;
         localStorage.setItem(DB_KEYS.CURRENT_USER, JSON.stringify(currentUser));
      }
    }
  },

  // --- ROLLCALL APIs ---

  // POST /rollcall/start
  startRollcall: async (courseId: string, type: RollcallType, durationMinutes: number, lat?: number, lng?: number) => {
    const rollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS);
    // Close any existing active rollcalls for this course
    rollcalls.forEach(r => {
      if (r.course_id === courseId && !r.end_time) r.end_time = Date.now();
    });

    const newRollcall: Rollcall = {
      id: 'rc-' + Date.now(),
      course_id: courseId,
      type,
      start_time: Date.now(),
      end_time: null,
      duration_minutes: durationMinutes,
      target_lat: lat,
      target_lng: lng,
      created_at: new Date().toISOString(),
    };
    saveList(DB_KEYS.ROLLCALLS, [...rollcalls, newRollcall]);
    return newRollcall;
  },

  // POST /rollcall/stop
  stopRollcall: async (rollcallId: string) => {
    const rollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS);
    const rc = rollcalls.find(r => r.id === rollcallId);
    if (rc) {
      rc.end_time = Date.now();
      saveList(DB_KEYS.ROLLCALLS, rollcalls);
    }
  },

  deleteRollcall: async (rollcallId: string) => {
    await delay(200);
    // Delete the rollcall info
    let rollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS);
    rollcalls = rollcalls.filter(r => r.id !== rollcallId);
    saveList(DB_KEYS.ROLLCALLS, rollcalls);

    // Delete associated records
    let records = getList<RollcallRecord>(DB_KEYS.RECORDS);
    records = records.filter(r => r.rollcall_id !== rollcallId);
    saveList(DB_KEYS.RECORDS, records);
  },

  // GET /rollcall/active (Check if any active)
  getActiveRollcall: async (courseId: string): Promise<Rollcall | undefined> => {
     // await delay(200); // Simulate net lag
     const rollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS);
     return rollcalls.find(r => r.course_id === courseId && r.end_time === null);
  },

  // POST /rollcall/check-in
  checkIn: async (studentId: string, rollcallId: string, lat?: number, lng?: number) => {
    await delay(500);
    const records = getList<RollcallRecord>(DB_KEYS.RECORDS);
    
    // Check if already checked in
    if (records.some(r => r.rollcall_id === rollcallId && r.student_id === studentId)) {
        return { status: 'already_checked_in' };
    }

    const rollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS);
    const rc = rollcalls.find(r => r.id === rollcallId);
    if (!rc || rc.end_time) throw new Error('點名已結束');

    // Logic for Status (Late vs Present)
    const elapsedMinutes = (Date.now() - rc.start_time) / 1000 / 60;
    let status = AttendanceStatus.PRESENT;
    // Example: Late if after 80% of duration (Simplified logic)
    if (elapsedMinutes > rc.duration_minutes) status = AttendanceStatus.LATE; 

    // Logic for GPS
    if (rc.type === RollcallType.GPS) {
       if (!lat || !lng) throw new Error('需要 GPS 定位');
       // 200m Check Mock
    }

    const newRecord: RollcallRecord = {
      id: 'rec-' + Date.now(),
      rollcall_id: rollcallId,
      student_id: studentId,
      status,
      time: new Date().toISOString(),
      gps_lat: lat,
      gps_lng: lng
    };
    saveList(DB_KEYS.RECORDS, [...records, newRecord]);
    return newRecord;
  },

  // GET /rollcall/records
  getRollcallRecords: async (rollcallId: string): Promise<{records: RollcallRecord[], students: User[]}> => {
    const records = getList<RollcallRecord>(DB_KEYS.RECORDS).filter(r => r.rollcall_id === rollcallId);
    const rollcall = getList<Rollcall>(DB_KEYS.ROLLCALLS).find(r => r.id === rollcallId);
    
    if (!rollcall) return { records: [], students: [] };

    // Get all students in course to determine Absent ones
    const courseStudents = getList<CourseStudent>(DB_KEYS.COURSE_STUDENTS)
        .filter(cs => cs.course_id === rollcall.course_id);
    const allUsers = getList<User>(DB_KEYS.USERS);
    
    const students = allUsers.filter(u => courseStudents.some(cs => cs.student_id === u.id));

    return { records, students };
  },

  getCourseRollcalls: async (courseId: string) => {
    await delay(300);
    const rollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS);
    const records = getList<RollcallRecord>(DB_KEYS.RECORDS);
    // Add stats to rollcalls
    const filtered = rollcalls.filter(r => r.course_id === courseId).sort((a,b) => b.start_time - a.start_time);
    
    // Get total students for course
    const courseStudentsCount = getList<CourseStudent>(DB_KEYS.COURSE_STUDENTS).filter(cs => cs.course_id === courseId).length;

    return filtered.map(r => ({
      ...r,
      present_count: records.filter(rec => rec.rollcall_id === r.id && [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EARLY_LEAVE].includes(rec.status)).length,
      total_students: courseStudentsCount
    }));
  },

  // Get specific student history in a course
  getStudentHistoryInCourse: async (courseId: string, studentId: string) => {
    await delay(300);
    const rollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS)
                     .filter(r => r.course_id === courseId)
                     .sort((a,b) => b.start_time - a.start_time);
    const allRecords = getList<RollcallRecord>(DB_KEYS.RECORDS);

    return rollcalls.map(rc => {
        const record = allRecords.find(r => r.rollcall_id === rc.id && r.student_id === studentId);
        return {
            rollcall: rc,
            record: record || null,
            status: record ? record.status : (rc.end_time ? AttendanceStatus.ABSENT : '未開始')
        };
    });
  },

  updateStudentAttendance: async (rollcallId: string, studentId: string, status: AttendanceStatus) => {
    const records = getList<RollcallRecord>(DB_KEYS.RECORDS);
    const existingIdx = records.findIndex(r => r.rollcall_id === rollcallId && r.student_id === studentId);
    
    if (existingIdx !== -1) {
        records[existingIdx].status = status;
        saveList(DB_KEYS.RECORDS, records);
    } else {
        const newRecord: RollcallRecord = {
            id: 'rec-' + Date.now(),
            rollcall_id: rollcallId,
            student_id: studentId,
            status,
            time: new Date().toISOString(),
        };
        saveList(DB_KEYS.RECORDS, [...records, newRecord]);
    }
  },

  getStudentStats: async (studentId: string) => {
    await delay(300);
    // Find all courses student is in
    const links = getList<CourseStudent>(DB_KEYS.COURSE_STUDENTS).filter(cs => cs.student_id === studentId);
    const courseIds = links.map(l => l.course_id);
    
    // Find all rollcalls for those courses
    const allRollcalls = getList<Rollcall>(DB_KEYS.ROLLCALLS).filter(r => courseIds.includes(r.course_id));
    
    // Find all records for student
    const allRecords = getList<RollcallRecord>(DB_KEYS.RECORDS).filter(r => r.student_id === studentId);
    
    const attendedCount = allRecords.filter(r => 
      [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EARLY_LEAVE].includes(r.status)
    ).length;

    return {
      total_rollcalls: allRollcalls.length,
      attended_count: attendedCount
    };
  },

  // --- BUZZER APIs ---

  // POST /buzz/start
  startBuzzer: async (courseId: string) => {
    const buzzers = getList<AnswerBuzz>(DB_KEYS.BUZZERS);
    // Close old ones
    buzzers.forEach(b => {
        if(b.course_id === courseId && !b.end_time) b.end_time = Date.now();
    });
    
    const newBuzz: AnswerBuzz = {
      id: 'buzz-' + Date.now(),
      course_id: courseId,
      start_time: Date.now(),
      end_time: null,
      winner_student_id: null
    };
    saveList(DB_KEYS.BUZZERS, [...buzzers, newBuzz]);
    return newBuzz;
  },

  // GET /buzz/status
  getBuzzerStatus: async (courseId: string): Promise<AnswerBuzz | undefined> => {
      const buzzers = getList<AnswerBuzz>(DB_KEYS.BUZZERS);
      // Return the most recent one if it's active or recently finished
      return buzzers.filter(b => b.course_id === courseId).sort((a,b) => b.start_time - a.start_time)[0];
  },

  // POST /buzz/answer
  buzz: async (studentId: string, buzzerId: string) => {
      const buzzers = getList<AnswerBuzz>(DB_KEYS.BUZZERS);
      const buzzIndex = buzzers.findIndex(b => b.id === buzzerId);
      
      if (buzzIndex === -1) throw new Error('活動不存在');
      const buzz = buzzers[buzzIndex];

      if (buzz.end_time || buzz.winner_student_id) {
          return { win: false, winnerId: buzz.winner_student_id };
      }

      // Winner!
      buzz.winner_student_id = studentId;
      buzz.end_time = Date.now(); // Close it immediately
      saveList(DB_KEYS.BUZZERS, buzzers);
      
      return { win: true, winnerId: studentId };
  },

  // --- RANDOM PICKER ---
  randomPick: async (courseId: string): Promise<User | null> => {
    const links = getList<CourseStudent>(DB_KEYS.COURSE_STUDENTS).filter(cs => cs.course_id === courseId);
    if (links.length === 0) return null;
    const randomLink = links[Math.floor(Math.random() * links.length)];
    const users = getList<User>(DB_KEYS.USERS);
    return users.find(u => u.id === randomLink.student_id) || null;
  }
};
