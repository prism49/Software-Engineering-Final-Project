export type UserRole = 'STUDENT' | 'TEACHER';
export type ProjectStatus = 'RECRUITING' | 'ACTIVE' | 'CLOSED';
export type MemberRole = 'LEADER' | 'MEMBER';
export type MemberStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MilestoneStatus = 'ACTIVE' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'DOING' | 'REVIEW' | 'DONE';

export interface User {
  user_id: number;
  username: string;
  email: string;
  nickname: string;
  role: UserRole;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Tag {
  tag_id: number;
  name: string;
}

export interface ProjectMemberSummary {
  user_id: number;
  role: MemberRole;
  status: MemberStatus;
}

export interface ProjectMemberDetail extends ProjectMemberSummary {
  username: string;
  nickname: string;
  joined_at: string;
}

export interface ProjectSummary {
  project_id: number;
  title: string;
  description: string | null;
  max_members: number;
  status: ProjectStatus;
  deadline: string;
  leader: Pick<User, 'user_id' | 'username' | 'nickname'>;
  member_count: number;
  members: ProjectMemberSummary[];
  tags: Tag[];
  task_count: number;
  created_at: string;
}

export interface MilestoneSummary {
  milestone_id: number;
  title: string;
  status: MilestoneStatus;
  due_date: string;
}

export interface ProjectDetail {
  project_id: number;
  title: string;
  description: string | null;
  max_members: number;
  status: ProjectStatus;
  deadline: string;
  leader: Pick<User, 'user_id' | 'username' | 'nickname'>;
  members: ProjectMemberDetail[];
  milestones: MilestoneSummary[];
  tags: Tag[];
  task_count: number;
  created_at: string;
}

export interface TaskPerson {
  user_id: number;
  username: string;
  nickname: string;
}

export interface TaskItem {
  task_id: number;
  project_id?: number;
  project?: {
    project_id: number;
    title: string;
  };
  title: string;
  description: string | null;
  status: TaskStatus;
  weight: number;
  due_date: string | null;
  milestone: {
    milestone_id: number;
    title: string;
  } | null;
  creator: TaskPerson;
  assignee: TaskPerson | null;
  created_at: string;
  updated_at: string;
}

export interface MessageResponse {
  message: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  email: string;
  nickname: string;
}

export interface CreateProjectPayload {
  title: string;
  description?: string;
  max_members?: number;
  deadline: string;
  tag_ids?: number[];
}

export interface UpdateProjectPayload {
  title?: string;
  description?: string;
  status?: ProjectStatus;
  deadline?: string;
  tag_ids?: number[];
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  milestone_id?: number;
  assignee_id?: number;
  weight?: number;
  due_date?: string;
}

export interface UpdateTaskPayload extends CreateTaskPayload {
  status?: TaskStatus;
}

export interface CreateMilestonePayload {
  title: string;
  description?: string;
  due_date: string;
}

export interface UpdateMilestonePayload extends Partial<CreateMilestonePayload> {}
