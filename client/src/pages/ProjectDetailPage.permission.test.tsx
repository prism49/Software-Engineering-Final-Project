import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { ProjectDetailPage } from './ProjectDetailPage';
import { useAuth } from '../store/auth';
import { api } from '../api/services';

// Mock 所有外部依赖
vi.mock('../store/auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/services', () => ({
  api: {
    getProject: vi.fn(),
    getTasksByProject: vi.fn(),
    getTags: vi.fn(),
    getProjectReviews: vi.fn(),
    getProjectContributions: vi.fn(),
    getProjectReportCharts: vi.fn(),
    exportProjectReport: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ================================================================
//  测试数据
// ================================================================
const leaderUser = {
  user_id: 1,
  username: 'leader',
  nickname: '队长',
  email: 'leader@test.com',
  role: 'STUDENT' as const,
  created_at: '2026-01-01T00:00:00Z',
};

const memberUser = {
  user_id: 2,
  username: 'member',
  nickname: '队员A',
  email: 'member@test.com',
  role: 'STUDENT' as const,
  created_at: '2026-01-01T00:00:00Z',
};

const nonMemberUser = {
  user_id: 3,
  username: 'outsider',
  nickname: '路人',
  email: 'outsider@test.com',
  role: 'STUDENT' as const,
  created_at: '2026-01-01T00:00:00Z',
};

function makeProject(overrides: any = {}) {
  return {
    project_id: 1,
    title: '测试项目',
    description: '这是一个测试项目',
    max_members: 5,
    status: 'RECRUITING',
    deadline: '2026-12-31',
    leader: { user_id: 1, username: 'leader', nickname: '队长' },
    members: [
      {
        user_id: 1,
        username: 'leader',
        nickname: '队长',
        role: 'LEADER',
        status: 'APPROVED',
        joined_at: '2026-01-01',
      },
      {
        user_id: 2,
        username: 'member',
        nickname: '队员A',
        role: 'MEMBER',
        status: 'APPROVED',
        joined_at: '2026-01-01',
      },
    ],
    milestones: [
      {
        milestone_id: 1,
        title: '里程碑1',
        description: '第一版',
        status: 'ACTIVE',
        due_date: '2026-06-30',
      },
    ],
    tags: [{ tag_id: 1, name: 'React' }],
    task_count: 3,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTasks() {
  return [
    {
      task_id: 1,
      project_id: 1,
      title: '任务1',
      description: '第一个任务',
      status: 'TODO' as const,
      weight: 1,
      due_date: null,
      milestone: null,
      creator: { user_id: 1, username: 'leader', nickname: '队长' },
      assignee: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      task_id: 2,
      project_id: 1,
      title: '任务2',
      description: '进行中的任务',
      status: 'DOING' as const,
      weight: 2,
      due_date: '2026-06-15',
      milestone: { milestone_id: 1, title: '里程碑1' },
      creator: { user_id: 1, username: 'leader', nickname: '队长' },
      assignee: { user_id: 2, username: 'member', nickname: '队员A' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      task_id: 3,
      project_id: 1,
      title: '任务3',
      description: '待审核的任务',
      status: 'REVIEW' as const,
      weight: 3,
      due_date: '2026-06-10',
      milestone: { milestone_id: 1, title: '里程碑1' },
      creator: { user_id: 2, username: 'member', nickname: '队员A' },
      assignee: { user_id: 2, username: 'member', nickname: '队员A' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];
}

function renderPage() {
  return render(
    <ConfigProvider>
      <MemoryRouter initialEntries={['/projects/1']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ConfigProvider>,
  );
}

describe('ProjectDetailPage — 权限按钮显示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认 mock 数据
    vi.mocked(api.getProject).mockResolvedValue(makeProject());
    vi.mocked(api.getTasksByProject).mockResolvedValue(makeTasks());
    vi.mocked(api.getTags).mockResolvedValue([{ tag_id: 1, name: 'React' }]);
  });

  // ================================================================
  //  Scenario 1: 未登录用户
  // ================================================================
  describe('未登录用户', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        token: null,
        loading: false,
        isAuthenticated: false,
        login: vi.fn(),
        register: vi.fn(),
        refreshProfile: vi.fn(),
        logout: vi.fn(),
      });
      vi.mocked(api.getProjectReviews).mockRejectedValue(new Error('未登录'));
    });

    it('显示"申请加入"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('申请加入')).toBeInTheDocument();
      });
    });

    it('显示项目标题', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: '测试项目' })).toBeInTheDocument();
      });
    });

    it('不显示"编辑项目"按钮（非队长）', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('编辑项目')).not.toBeInTheDocument();
      });
    });

    it('不显示"新建任务"按钮（非成员）', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('新建任务')).not.toBeInTheDocument();
      });
    });

    it('不显示"新建里程碑"按钮（非成员）', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('新建里程碑')).not.toBeInTheDocument();
      });
    });
  });

  // ================================================================
  //  Scenario 2: 已登录但非项目成员
  // ================================================================
  describe('已登录但非项目成员', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: nonMemberUser,
        token: 'token',
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        refreshProfile: vi.fn(),
        logout: vi.fn(),
      });
      vi.mocked(api.getProjectReviews).mockRejectedValue(
        new Error('你不是该项目已批准的成员'),
      );
    });

    it('显示"申请加入"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('申请加入')).toBeInTheDocument();
      });
    });

    it('不显示"编辑项目"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('编辑项目')).not.toBeInTheDocument();
      });
    });
  });

  // ================================================================
  //  Scenario 3: 项目已批准成员
  // ================================================================
  describe('项目已批准成员', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: memberUser,
        token: 'token',
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        refreshProfile: vi.fn(),
        logout: vi.fn(),
      });
      vi.mocked(api.getProjectReviews).mockResolvedValue([]);
    });

    it('不显示"申请加入"按钮（已是成员）', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('申请加入')).not.toBeInTheDocument();
      });
    });

    it('不显示"编辑项目"按钮（非队长）', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('编辑项目')).not.toBeInTheDocument();
      });
    });

    it('显示"新建任务"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('新建任务')).toBeInTheDocument();
      });
    });

    it('显示"新建里程碑"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('新建里程碑')).toBeInTheDocument();
      });
    });
  });

  // ================================================================
  //  Scenario 4: 项目队长（Leader）
  // ================================================================
  describe('项目队长（Leader）', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: leaderUser,
        token: 'token',
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        refreshProfile: vi.fn(),
        logout: vi.fn(),
      });
      vi.mocked(api.getProjectReviews).mockResolvedValue([]);
    });

    it('显示"编辑项目"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('编辑项目')).toBeInTheDocument();
      });
    });

    it('不显示"申请加入"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('申请加入')).not.toBeInTheDocument();
      });
    });

    it('显示"新建任务"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('新建任务')).toBeInTheDocument();
      });
    });

    it('显示"新建里程碑"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('新建里程碑')).toBeInTheDocument();
      });
    });
  });

  // ================================================================
  //  Scenario 5: 项目已关闭 + 成员
  // ================================================================
  describe('项目已关闭时成员可互评', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: memberUser,
        token: 'token',
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        refreshProfile: vi.fn(),
        logout: vi.fn(),
      });
      vi.mocked(api.getProject).mockResolvedValue(
        makeProject({ status: 'CLOSED' }),
      );
      vi.mocked(api.getProjectReviews).mockResolvedValue([]);
      vi.mocked(api.getProjectContributions).mockResolvedValue([]);
      vi.mocked(api.getProjectReportCharts).mockResolvedValue(null);
    });

    it('项目已关闭时显示"提交互评"区域', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('提交互评')).toBeInTheDocument();
      });
    });

    it('项目已关闭时显示"导出 Excel"按钮', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('导出 Excel')).toBeInTheDocument();
      });
    });
  });

  // ================================================================
  //  Scenario 6: 项目不存在
  // ================================================================
  describe('项目不存在', () => {
    it('显示"项目不存在或加载失败"', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        token: null,
        loading: false,
        isAuthenticated: false,
        login: vi.fn(),
        register: vi.fn(),
        refreshProfile: vi.fn(),
        logout: vi.fn(),
      });
      vi.mocked(api.getProject).mockRejectedValue(new Error('项目不存在'));

      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText('项目不存在或加载失败'),
        ).toBeInTheDocument();
      });
    });
  });
});