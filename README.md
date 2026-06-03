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

```bash
cd client

# 1. 安装依赖
npm install

# 2. 启动前端
npm run dev
#  同时启动后端、前端后，访问：http://localhost:5173
```

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

## 业务规则

| 规则 | 说明 |
|---|---|
| 仅队长可修改项目 | `PATCH /api/projects/:id`（标题/描述/状态/标签/截止日） |
| 仅队长可审批成员 | `PATCH /api/projects/:id/members/:userId` |
| 仅队长可关闭项目 | 关闭时所有任务必须为 DONE |
| 关闭后才可互评 | 项目 status=CLOSED 才可 POST reviews |
| 不能给自己评分 | POST reviews 时 target_id ≠ 自己 |
| 同一人对同一人只能评一次 | 唯一约束，可 PUT 修改 |
| 仅评分人可修改评分 | PUT /api/reviews/:id 校验 reviewer_id |
| 学生互评匿名 | GET reviews 学生只看自己被评的分，不显示评分人 |
| 教师看全量 | GET reviews 教师可查看全部评分人和被评人 |
| 里程碑不可手动改状态 | 只能通过 POST /api/milestones/:id/complete 自动校验完成 |
| 贡献度需互评完成 | 所有成员均需给其他每位成员打分后才可查看 |
| 报表需互评完成 | charts 和 export 同样校验所有成员互评完成 |

**完整项目生命周期：**

```
创建项目 → 招募成员 → 分配任务 → 完成任务(DONE)
    → 队长关闭项目(CLOSED) → 成员互评 → 查看贡献度 → 导出报表
```

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
| ✅ 前端工程初始化 | 已完成 |
| ✅ 前端基础架构搭建 | 已完成 |
| ✅ UI组件库 + 前后端接口联调 | 已完成 |
| ✅ 布局 + 页面开发 | 已完成 |
| ✅ 双盲互评 + 贡献度算法 + 报表导出 | 已完成 |
| 🔜 前后端联调测试 | 下一步 |
