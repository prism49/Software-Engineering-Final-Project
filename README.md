# TeamSync

校园微团队敏捷协作与贡献度评估系统。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面容器 | Electron |
| 前端 | React + Vite + TypeScript + Ant Design |
| 后端 | NestJS + TypeScript + Prisma ORM |
| 数据库 | MySQL（阿里云 RDS） |
| 测试 | Vitest / Jest / Supertest / Playwright |
| CI/CD | GitHub Actions |

## 项目结构

```
TeamSync/
├── client/          # 前端 React 项目（成员 A 负责）
├── server/          # 后端 NestJS 项目（成员 B 负责）
├── electron/        # Electron 桌面壳（成员 C 负责）
├── docs/            # 项目文档
│   └── api-design.md          # API 接口文档
├── README.md
└── TeamSync 项目书.md
```

## 快速开始

### 前置要求

- Node.js >= 20
- npm

### 后端开发（成员 B）

```bash
cd server

# 1. 安装依赖
npm install

# 2. 生成 Prisma Client
npx prisma generate

# 3. 启动
npm run start
# → http://localhost:3000/api

#  Swagger 文档：启动后端后访问：http://localhost:3000/api/docs，可在线查看所有接口、填写参数、发送请求并查看返回结果。
```

### 前端开发（成员 A）

> TODO：待前端初始化后补充

### Electron 集成（成员 C）

> TODO：待 Electron 初始化后补充

## 开发流程

项目按以下阶段推进：

| 阶段 | 内容 | 负责人 |
|---|---|---|
| 第一阶段 | 工程初始化 + 数据库设计 + API 设计 | B |
| 第二阶段 | 后端核心（认证 / 项目 / 任务模块） | B |
| 第三阶段 | 前端业务联调 | A |
| 第四阶段 | 双盲互评 + 贡献度算法 + 报表 | A + B |
| 第五阶段 | 测试 + CI/CD | C |
| 第六阶段 | Electron 打包 + 交付 | C |

## 业务状态机

### 任务（Task）

```
TODO ──→ DOING ──→ REVIEW ──→ DONE
            ↑        │
            └── 打回 ←┘
```

| 流转 | 说明 |
|---|---|
| TODO → DOING | 项目成员认领 |
| DOING → REVIEW | 只有任务执行人 |
| REVIEW → DONE | 任何项目成员（但不能是执行人自己） |
| REVIEW → DOING | 打回（同上，不能是执行人自己） |

### 里程碑（Milestone）

```
ACTIVE ──→ COMPLETED
```

- 新建为 `ACTIVE`
- **不可手动修改状态**，必须调用 `POST /api/milestones/:id/complete`
- 该校验：里程碑下至少有一个任务，且**所有任务均为 DONE** 才可完成

### 项目状态

```
RECRUITING   ←→  ACTIVE
     │              │
     └──→ CLOSED ←──┘
```

- 队长通过 `PATCH /api/projects/:id` 手动切换
- 满员审批通过时自动 RECRUITING → ACTIVE
- CLOSED 为终态，不可回退

## Commit 规范

```
feat: 新功能
fix: 修复问题
docs: 文档修改
refactor: 重构
test: 测试代码
style: 格式调整
```

## 当前进度

| 步骤 | 状态 |
|---|---|
| ✅ 数据库设计 | 已完成 |
| ✅ 后端工程初始化 | 已完成 |
| ✅ 数据表落地 | 已完成 |
| ✅ 用户认证模块 | 已完成 |
| ✅ 项目 + 任务 + 里程碑 + 标签 | 已完成 |
| ✅ 全局异常处理 + 日志 + API 文档 | 已完成 |
| 🔜 双盲互评 + 贡献度 + 报表 | 下一步 |
| ⬜ 前端初始化 | 待开始 |