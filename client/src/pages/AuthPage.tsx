import { Card, Tabs, Form, Input, Button, message, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

export function AuthPage() {
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const handleLogin = async () => {
    try {
      const values = await loginForm.validateFields();
      await login(values);
      messageApi.success('登录成功');
      navigate('/projects', { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const handleRegister = async () => {
    try {
      const values = await registerForm.validateFields();
      await register(values);
      messageApi.success('注册成功，请登录');
      loginForm.setFieldsValue({
        username: values.username,
        password: values.password,
      });
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  return (
    <div className="auth-page">
      {contextHolder}
      <Card className="auth-card" variant="borderless">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title level={2}>TeamSync</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            校园微团队敏捷协作与贡献度评估系统
          </Typography.Paragraph>
        </div>

        <Tabs
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form layout="vertical" form={loginForm} style={{ marginTop: 16 }}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input placeholder="请输入用户名" size="large" />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password placeholder="请输入密码" size="large" />
                  </Form.Item>
                  <Button type="primary" block size="large" onClick={() => void handleLogin()} style={{ marginTop: 8 }}>
                    登录
                  </Button>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form layout="vertical" form={registerForm} style={{ marginTop: 16 }}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[
                      { required: true, message: '请输入用户名' },
                      { min: 2, max: 32, message: '用户名长度需为 2-32 位' },
                    ]}
                  >
                    <Input placeholder="例如：zhangsan" size="large" />
                  </Form.Item>
                  <Form.Item
                    label="邮箱"
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '邮箱格式不正确' },
                    ]}
                  >
                    <Input placeholder="例如：zhangsan@test.com" size="large" />
                  </Form.Item>
                  <Form.Item
                    label="昵称"
                    name="nickname"
                    rules={[
                      { required: true, message: '请输入昵称' },
                      { min: 1, max: 50, message: '昵称长度需为 1-50 位' },
                    ]}
                  >
                    <Input placeholder="例如：张三" size="large" />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, max: 50, message: '密码长度需为 6-50 位' },
                    ]}
                  >
                    <Input.Password placeholder="请输入密码" size="large" />
                  </Form.Item>
                  <Button type="primary" block size="large" onClick={() => void handleRegister()} style={{ marginTop: 8 }}>
                    注册
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
