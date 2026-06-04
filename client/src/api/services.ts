import { http } from './http';
import type {
  AuthResponse,
  ContributionItem,
  CreateMilestonePayload,
  CreateProjectPayload,
  CreateReviewPayload,
  CreateTaskPayload,
  LoginPayload,
  MessageResponse,
  ProjectDetail,
  ProjectReview,
  ProjectStatus,
  ProjectSummary,
  ReportCharts,
  RegisterPayload,
  Tag,
  TaskItem,
  TaskStatus,
  UpdateMilestonePayload,
  UpdateProjectPayload,
  UpdateReviewPayload,
  UpdateTaskPayload,
  User,
} from '../types';

export const api = {
  register: async (payload: RegisterPayload) => {
    const { data } = await http.post<User>('/auth/register', payload);
    return data;
  },
  login: async (payload: LoginPayload) => {
    const { data } = await http.post<AuthResponse>('/auth/login', payload);
    return data;
  },
  getCurrentUser: async () => {
    const { data } = await http.get<User>('/auth/me');
    return data;
  },
  getProjects: async (params?: { status?: ProjectStatus; tag?: string }) => {
    const { data } = await http.get<ProjectSummary[]>('/projects', { params });
    return data;
  },
  getProject: async (projectId: number) => {
    const { data } = await http.get<ProjectDetail>(`/projects/${projectId}`);
    return data;
  },
  createProject: async (payload: CreateProjectPayload) => {
    const { data } = await http.post<{ project_id: number; title: string }>('/projects', payload);
    return data;
  },
  updateProject: async (projectId: number, payload: UpdateProjectPayload) => {
    const { data } = await http.patch<MessageResponse>(`/projects/${projectId}`, payload);
    return data;
  },
  applyToProject: async (projectId: number, apply_reason?: string) => {
    const { data } = await http.post<MessageResponse>(`/projects/${projectId}/apply`, {
      apply_reason,
    });
    return data;
  },
  approveMember: async (
    projectId: number,
    userId: number,
    status: 'APPROVED' | 'REJECTED',
  ) => {
    const { data } = await http.patch<MessageResponse>(
      `/projects/${projectId}/members/${userId}`,
      { status },
    );
    return data;
  },
  getTags: async () => {
    const { data } = await http.get<Tag[]>('/tags');
    return data;
  },
  getMyTags: async () => {
    const { data } = await http.get<Tag[]>('/users/me/tags');
    return data;
  },
  updateMyTags: async (tag_ids: number[]) => {
    const { data } = await http.put<Tag[]>('/users/me/tags', { tag_ids });
    return data;
  },
  getTasksByProject: async (projectId: number, status?: TaskStatus) => {
    const { data } = await http.get<TaskItem[]>(`/projects/${projectId}/tasks`, {
      params: status ? { status } : undefined,
    });
    return data;
  },
  createTask: async (projectId: number, payload: CreateTaskPayload) => {
    const { data } = await http.post(`/projects/${projectId}/tasks`, payload);
    return data;
  },
  updateTask: async (taskId: number, payload: UpdateTaskPayload) => {
    const { data } = await http.patch<MessageResponse>(`/tasks/${taskId}`, payload);
    return data;
  },
  reviewTask: async (taskId: number, action: 'DONE' | 'DOING') => {
    const { data } = await http.patch<MessageResponse>(`/tasks/${taskId}/review`, { action });
    return data;
  },
  deleteTask: async (taskId: number) => {
    const { data } = await http.delete<MessageResponse>(`/tasks/${taskId}`);
    return data;
  },
  createMilestone: async (projectId: number, payload: CreateMilestonePayload) => {
    const { data } = await http.post(`/projects/${projectId}/milestones`, payload);
    return data;
  },
  updateMilestone: async (milestoneId: number, payload: UpdateMilestonePayload) => {
    const { data } = await http.patch<MessageResponse>(`/milestones/${milestoneId}`, payload);
    return data;
  },
  completeMilestone: async (milestoneId: number) => {
    const { data } = await http.post<MessageResponse>(`/milestones/${milestoneId}/complete`);
    return data;
  },
  deleteMilestone: async (milestoneId: number) => {
    const { data } = await http.delete<MessageResponse>(`/milestones/${milestoneId}`);
    return data;
  },
  getProjectReviews: async (projectId: number) => {
    const { data } = await http.get<ProjectReview[]>(`/projects/${projectId}/reviews`);
    return data;
  },
  createProjectReview: async (projectId: number, payload: CreateReviewPayload) => {
    const { data } = await http.post<{ review_id: number; message: string }>(
      `/projects/${projectId}/reviews`,
      payload,
    );
    return data;
  },
  updateProjectReview: async (reviewId: number, payload: UpdateReviewPayload) => {
    const { data } = await http.put<MessageResponse>(`/reviews/${reviewId}`, payload);
    return data;
  },
  getProjectContributions: async (projectId: number) => {
    const { data } = await http.get<ContributionItem[]>(`/projects/${projectId}/contributions`);
    return data;
  },
  getProjectReportCharts: async (projectId: number) => {
    const { data } = await http.get<ReportCharts>(`/projects/${projectId}/report/charts`);
    return data;
  },
  exportProjectReport: async (projectId: number) => {
    const { data } = await http.get<Blob>(`/projects/${projectId}/report/export`, {
      responseType: 'blob',
    });
    return data;
  },
};
