
// 9. ERD Implementation & Data Types

export enum Role {
  TEACHER = 'teacher',
  STUDENT = 'student',
}

export interface User {
  id: string;
  role: Role;
  name: string;
  username: string; // Student ID for students
  password_hash: string; // In mock, plain text for simplicity, but labeled as hash
  avatar_url: string;
  group?: string; // New: For customizable lists
  created_at: string;
}

export interface Course {
  id: string;
  teacher_id: string;
  name: string;
  created_at: string;
}

export interface CourseStudent {
  id: string;
  course_id: string;
  student_id: string;
}

export enum RollcallType {
  IMMEDIATE = 'immediate',
  GPS = 'gps',
}

export enum AttendanceStatus {
  PRESENT = '出席', // Green
  LATE = '遲到', // Orange
  ABSENT = '缺席', // Red
  LEAVE = '請假', // Blue
  EARLY_LEAVE = '早退', // White/Gray
}

export interface Rollcall {
  id: string;
  course_id: string;
  type: RollcallType;
  start_time: number; // Timestamp
  end_time: number | null; // Timestamp, null if active
  duration_minutes: number;
  target_lat?: number;
  target_lng?: number;
  created_at: string;
}

export interface RollcallRecord {
  id: string;
  rollcall_id: string;
  student_id: string;
  status: AttendanceStatus;
  time: string; // ISO String
  gps_lat?: number;
  gps_lng?: number;
}

export interface AnswerBuzz {
  id: string;
  course_id: string;
  start_time: number;
  end_time: number | null;
  winner_student_id: string | null;
}

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
