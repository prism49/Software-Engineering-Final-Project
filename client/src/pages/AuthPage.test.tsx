import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthPage } from './AuthPage';
import { useAuth } from '../store/auth';

vi.mock('../store/auth', () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderAuthPage() {
  return render(
    <ConfigProvider>
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    </ConfigProvider>,
  );
}

/** antd 对纯中文按钮文本插入空格 */
function antdBtnText(text: string) {
  return text.split('').join(' ');
}

describe('AuthPage — 登录页', () => {
  const mockLogin = vi.fn();
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      register: mockRegister,
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      refreshProfile: vi.fn(),
      logout: vi.fn(),
    });
  });

  // ================================================================
  //  页面渲染
  // ================================================================
  describe('页面渲染', () => {
    it('渲染页标题和副标题', () => {
      renderAuthPage();
      expect(screen.getByText('TeamSync')).toBeInTheDocument();
      expect(
        screen.getByText('校园微团队敏捷协作与贡献度评估系统'),
      ).toBeInTheDocument();
    });

    it('渲染登录/注册标签页', () => {
      renderAuthPage();
      expect(screen.getAllByText('登录').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('注册').length).toBeGreaterThanOrEqual(1);
    });

    it('登录 Tab 默认显示的输入框', () => {
      renderAuthPage();
      expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    });
  });

  // ================================================================
  //  登录按钮
  // ================================================================
  describe('登录按钮', () => {
    it('登录按钮存在且可点击', async () => {
      renderAuthPage();
      const btn = screen.getByText(antdBtnText('登录'));
      expect(btn).toBeInTheDocument();
    });
  });

  // ================================================================
  //  登录流程
  // ================================================================
  describe('登录流程', () => {
    it('填写凭据后调用 login API', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ access_token: 'token', user: {} });
      renderAuthPage();

      await user.type(screen.getByPlaceholderText('请输入用户名'), 'testuser');
      const pwdInputs = screen.getAllByPlaceholderText('请输入密码');
      await user.type(pwdInputs[0], 'password123');

      // 点击登录按钮触发表单提交
      const loginBtn = screen.getByText(antdBtnText('登录')).closest('button')!;
      await act(async () => {
        loginBtn.click();
      });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123',
        });
      });
    });

    it('登录成功后导航到项目页', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ access_token: 'token', user: {} });
      renderAuthPage();

      await user.type(screen.getByPlaceholderText('请输入用户名'), 'testuser');
      const pwdInputs = screen.getAllByPlaceholderText('请输入密码');
      await user.type(pwdInputs[0], 'password123');

      await act(async () => {
        screen.getByText(antdBtnText('登录')).closest('button')!.click();
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects', {
          replace: true,
        });
      });
    });

    it('登录失败时捕获错误', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('用户名或密码错误'));
      renderAuthPage();

      await user.type(screen.getByPlaceholderText('请输入用户名'), 'wronguser');
      const pwdInputs = screen.getAllByPlaceholderText('请输入密码');
      await user.type(pwdInputs[0], 'wrongpass');

      await act(async () => {
        screen.getByText(antdBtnText('登录')).closest('button')!.click();
      });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });
  });

  // ================================================================
  //  注册流程
  // ================================================================
  describe('注册流程', () => {
    it('注册按钮存在', async () => {
      renderAuthPage();
      const registerTab = screen.getAllByText('注册')[0];
      await act(async () => {
        registerTab.click();
      });

      await waitFor(() => {
        expect(screen.getByText(antdBtnText('注册'))).toBeInTheDocument();
      });
    });

    it('调用 register API', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({
        user_id: 2,
        username: 'newuser',
        email: 'new@test.com',
        nickname: 'New',
        role: 'STUDENT',
        created_at: '2026-01-01',
      });
      renderAuthPage();

      // 切换到注册
      const registerTab = screen.getAllByText('注册')[0];
      await act(async () => {
        registerTab.click();
      });

      // 填写注册表单
      await waitFor(() => {
        expect(screen.getByPlaceholderText('例如：zhangsan')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('例如：zhangsan'), 'newuser');
      await user.type(
        screen.getByPlaceholderText('例如：zhangsan@test.com'),
        'new@test.com',
      );
      await user.type(screen.getByPlaceholderText('例如：张三'), 'New');

      // 密码输入框（注册面板中的）
      const allPwd = screen.getAllByPlaceholderText('请输入密码');
      // 登录面板和注册面板各有一个密码输入框
      // 注册面板密码框是最后一个
      await user.type(allPwd[allPwd.length - 1], 'password123');

      await act(async () => {
        screen.getByText(antdBtnText('注册')).closest('button')!.click();
      });

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalled();
      });
    });
  });
});