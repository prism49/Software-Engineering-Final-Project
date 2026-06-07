import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth';
import { api } from '../api/services';

// Mock API 模块
vi.mock('../api/services', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

const mockUser = {
  user_id: 1,
  username: 'testuser',
  email: 'test@test.com',
  nickname: '测试用户',
  role: 'STUDENT' as const,
  created_at: '2026-01-01T00:00:00Z',
};

function TestConsumer() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="is-authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="user-id">{auth.user?.user_id ?? 'null'}</div>
      <div data-testid="user-role">{auth.user?.role ?? 'null'}</div>
      <button
        data-testid="btn-login"
        onClick={() => auth.login({ username: 'testuser', password: 'pass' })}
      >
        Login
      </button>
      <button
        data-testid="btn-register"
        onClick={() =>
          auth.register({
            username: 'newuser',
            email: 'new@test.com',
            password: 'pass',
            nickname: 'New',
          })
        }
      >
        Register
      </button>
      <button data-testid="btn-logout" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('未登录时 isAuthenticated 为 false', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('no token'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });
  });

  it('已存在 token 时尝试刷新用户信息', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser);
    localStorage.setItem('teamsync_token', 'existing-token');
    localStorage.setItem('teamsync_user', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      // token 存在，loading 完成后应显示用户信息
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('getCurrentUser 失败时清除 token', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('invalid token'));
    localStorage.setItem('teamsync_token', 'bad-token');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    expect(localStorage.getItem('teamsync_token')).toBeNull();
  });

  it('login 成功后设置 token 和用户', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('no token'));
    vi.mocked(api.login).mockResolvedValue({
      access_token: 'jwt-token',
      user: mockUser,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // 点击登录
    await act(async () => {
      screen.getByTestId('btn-login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-id').textContent).toBe('1');
    });

    expect(localStorage.getItem('teamsync_token')).toBe('jwt-token');
    expect(localStorage.getItem('teamsync_user')).toContain('testuser');
  });

  it('logout 清除 token 和用户', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('no token'));
    vi.mocked(api.login).mockResolvedValue({
      access_token: 'jwt-token',
      user: mockUser,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // 先登录
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('btn-login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    });

    // 再登出
    await act(async () => {
      screen.getByTestId('btn-logout').click();
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user-id').textContent).toBe('null');
    expect(localStorage.getItem('teamsync_token')).toBeNull();
  });

  it('register 调用 API', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('no token'));
    vi.mocked(api.register).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('btn-register').click();
    });

    expect(api.register).toHaveBeenCalledWith({
      username: 'newuser',
      email: 'new@test.com',
      password: 'pass',
      nickname: 'New',
    });
  });
});

describe('useAuth hook', () => {
  it('在 AuthProvider 外使用抛异常', () => {
    // 禁止 React 的错误输出以免干扰
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used inside AuthProvider',
    );

    consoleSpy.mockRestore();
  });
});