# TeamSync API 接口文档

## 基础信息

- **Base URL:** `http://localhost:3000/api`
- **请求格式:** `Content-Type: application/json`（所有 POST/PATCH/PUT 请求）
- **鉴权方式:** 需要登录的接口在 Header 中携带 `Authorization: Bearer <token>`
- **Swagger:** 启动后访问 `http://localhost:3000/api/docs` 可在线测试

## 统一错误返回格式

```json
{
  "statusCode": 400,
  "message": "错误描述",
  "timestamp": "2026-06-01T08:00:00.000Z",
  "path": "/api/auth/login"
}
```

常见状态码：`400` 参数错误 / `401` 未登录 / `403` 无权限 / `404` 不存在 / `409` 冲突 / `500` 服务端错误

---

## 一、Auth（用户认证）

### 1.1 注册

```
POST /api/auth/register
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| username | string | 是 | 用户名，2-32 字符 |
| email | string | 是 | 邮箱 |
| password | string | 是 | 密码，6-50 字符 |
| nickname | string | 是 | 昵称，1-50 字符 |

请求示例：
```json
{
  "username": "zhangsan",
  "email": "zhangsan@test.com",
  "password": "123456",
  "nickname": "张三"
}
```

返回示例：
```json
{
  "user_id": 1,
  "username": "zhangsan",
  "email": "zhangsan@test.com",
  "nickname": "张三",
  "role": "STUDENT",
  "created_at": "2026-06-01T00:00:00.000Z"
}
```

> 错误：`409` 用户名已存在 / 邮箱已被注册

---

### 1.2 登录

```
POST /api/auth/login
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

请求示例：
```json
{
  "username": "zhangsan",
  "password": "123456"
}
```

返回示例：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "user_id": 1,
    "username": "zhangsan",
    "email": "zhangsan@test.com",
    "nickname": "张三",
    "role": "STUDENT",
    "created_at": "2026-06-01T00:00:00.000Z"
  }
}
```

> 错误：`401` 用户名或密码错误

---

### 1.3 获取当前用户

```
GET /api/auth/me
```

Header：`Authorization: Bearer <token>`

返回示例：
```json
{
  "user_id": 1,
  "username": "zhangsan",
  "email": "zhangsan@test.com",
  "nickname": "张三",
  "role": "STUDENT",
  "created_at": "2026-06-01T00:00:00.000Z"
}
```

> 错误：`401` 未登录 / Token 无效

---

## 二、Project（项目）

### 2.1 项目大厅

```
GET /api/projects
```

可选查询参数：`?status=RECRUITING` | `?tag=Python`

返回示例：
```json
[
  {
    "project_id": 1,
    "title": "软件工程课设",
    "description": "开发一个校园协作平台",
    "max_members": 3,
    "status": "RECRUITING",
    "deadline": "2026-07-15T00:00:00.000Z",
    "leader": {
      "user_id": 1,
      "username": "zhangsan",
      "nickname": "张三"
    },
    "member_count": 2,
    "members": [
      { "user_id": 1, "role": "LEADER", "status": "APPROVED" },
      { "user_id": 2, "role": "MEMBER", "status": "PENDING" }
    ],
    "tags": [
      { "tag_id": 1, "name": "Python" }
    ],
    "task_count": 3,
    "created_at": "2026-05-31T15:58:07.433Z"
  }
]
```

---

### 2.2 项目详情

```
GET /api/projects/:id
```

返回示例：
```json
{
  "project_id": 1,
  "title": "软件工程课设",
  "description": "开发一个校园协作平台",
  "max_members": 3,
  "status": "RECRUITING",
  "deadline": "2026-07-15T00:00:00.000Z",
  "leader": {
    "user_id": 1,
    "username": "zhangsan",
    "nickname": "张三"
  },
  "members": [
    {
      "user_id": 1,
      "username": "zhangsan",
      "nickname": "张三",
      "role": "LEADER",
      "status": "APPROVED",
      "joined_at": "2026-05-31T15:58:07.433Z"
    }
  ],
  "milestones": [
    {
      "milestone_id": 1,
      "title": "第一阶段",
      "status": "ACTIVE",
      "due_date": "2026-06-20T00:00:00.000Z"
    }
  ],
  "tags": [{ "tag_id": 1, "name": "Python" }],
  "task_count": 3,
  "created_at": "2026-05-31T15:58:07.433Z"
}
```

> 错误：`404` 项目不存在

---

### 2.3 创建项目

```
POST /api/projects
```

需要 Header：`Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 是 | 项目名，1-100 字符 |
| description | string | 否 | 项目描述 |
| max_members | int | 否 | 人数上限，默认 5，范围 2-20 |
| deadline | string | 是 | 截止日期，ISO 8601 格式 |
| tag_ids | int[] | 否 | 项目需求标签 ID 数组 |

请求示例：
```json
{
  "title": "软件工程课设",
  "description": "开发校园协作平台",
  "max_members": 3,
  "deadline": "2026-07-15",
  "tag_ids": [1, 5]
}
```

返回示例：
```json
{
  "project_id": 1,
  "title": "软件工程课设"
}
```

> 说明：创建者自动成为队长并加入项目（APPROVED 状态）

---

### 2.4 修改项目

```
PATCH /api/projects/:id
```

需要 Header：`Authorization: Bearer <token>`（**仅队长可操作**）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 否 | 新标题，1-100 字符 |
| description | string | 否 | 新描述 |
| status | string | 否 | 项目状态，见下方规则 |
| deadline | string | 否 | 截止日期，ISO 8601 格式 |
| tag_ids | int[] | 否 | 标签 ID 数组（替换式） |

**状态流转规则：**

```
RECRUITING  ←→   ACTIVE
     │              │
     └──→ CLOSED ←──┘
```

- 队长可手动切换 `RECRUITING ↔ ACTIVE`
- 任何状态都可直接关闭为 `CLOSED`
- `CLOSED` 不可回退

请求示例：
```json
{
  "title": "软件工程课设（重构版）",
  "status": "ACTIVE",
  "tag_ids": [1, 3, 5]
}
```

返回示例：
```json
{ "message": "项目已更新" }
```

> 错误：`404` 项目不存在 / `403` 仅队长可操作 / `400` 非法状态流转 / `400` 已关闭的项目不能修改状态

---

### 2.5 申请加入

```
POST /api/projects/:id/apply
```

需要 Header：`Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apply_reason | string | 否 | 申请理由 |

请求示例：
```json
{
  "apply_reason": "我对这个项目很感兴趣"
}
```

返回示例：
```json
{ "message": "申请已提交，等待队长审批" }
```

> 错误：`404` 项目不存在 / `400` 不在招募阶段 / `400` 已满员 / `409` 已申请 / `409` 已是成员

---

### 2.6 审批成员

```
PATCH /api/projects/:id/members/:userId
```

需要 Header：`Authorization: Bearer <token>`（**仅队长可操作**）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | `"APPROVED"` 或 `"REJECTED"` |

请求示例：
```json
{
  "status": "APPROVED"
}
```

返回示例：
```json
{ "message": "已批准" }
```

> 错误：`403` 仅队长可审批 / `404` 申请记录不存在 / `400` 已处理过

---

## 三、Task（任务）

### 3.1 项目任务列表

```
GET /api/projects/:id/tasks
```

可选查询参数：`?status=TODO` | `?status=DOING` | `?status=REVIEW` | `?status=DONE`

返回示例：
```json
[
  {
    "task_id": 1,
    "project_id": 1,
    "title": "编写需求文档",
    "description": "产出 SRS 文档",
    "status": "TODO",
    "weight": 3,
    "due_date": "2026-06-18T00:00:00.000Z",
    "milestone": {
      "milestone_id": 1,
      "title": "第一阶段"
    },
    "creator": {
      "user_id": 1,
      "username": "zhangsan",
      "nickname": "张三"
    },
    "assignee": null,
    "created_at": "2026-06-01T00:00:00.000Z",
    "updated_at": "2026-06-01T00:00:00.000Z"
  }
]
```

---

### 3.2 任务详情

```
GET /api/tasks/:id
```

返回格式同上，此外增加 `project` 字段：
```json
{
  "task_id": 1,
  "project": { "project_id": 1, "title": "软件工程课设" },
  ...
}
```

> 错误：`404` 任务不存在

---

### 3.3 创建任务

```
POST /api/projects/:id/tasks
```

需要 Header：`Authorization: Bearer <token>`（需为项目成员）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 是 | 任务标题，1-200 字符 |
| description | string | 否 | 任务描述 |
| milestone_id | int | 否 | 所属里程碑 ID |
| assignee_id | int | 否 | 指派人 ID（不填则状态为 TODO，填了直接 DOING） |
| weight | int | 否 | 权重 1-5，默认 1 |
| due_date | string | 否 | 截止日期，ISO 8601 格式 |

请求示例：
```json
{
  "title": "编写需求文档",
  "description": "产出 SRS 文档",
  "weight": 3,
  "milestone_id": 1,
  "due_date": "2026-06-18"
}
```

返回示例：
```json
{
  "task_id": 1,
  "title": "编写需求文档",
  "status": "TODO"
}
```

> 错误：`403` 不是该项目成员

---

### 3.4 更新任务（含状态流转）

```
PATCH /api/tasks/:id
```

需要 Header：`Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 否 | 新标题 |
| description | string | 否 | 新描述 |
| status | string | 否 | 新状态，见状态机规则 |
| assignee_id | int | 否 | 新指派人 |
| weight | int | 否 | 权重 1-5 |
| milestone_id | int | 否 | 里程碑 ID |
| due_date | string | 否 | 截止日期，ISO 8601 格式 |

### 状态机规则

```
TODO ──→ DOING ──→ REVIEW ──→ DONE
            ↑        │
            └── 打回 ←┘
```

| 流转 | 操作方式 | 权限 |
|---|---|---|
| TODO → DOING | `PATCH` 传 `{"status":"DOING"}`（不传 assignee_id） | 项目成员，系统自动认领 |
| DOING → REVIEW | `PATCH` 传 `{"status":"REVIEW"}` | 只有任务执行人 |
| REVIEW → DONE | `PATCH /api/tasks/:id/review` 传 `{"action":"DONE"}` | 任何成员（不能是执行人自己） |
| REVIEW → DOING | `PATCH /api/tasks/:id/review` 传 `{"action":"DOING"}` | 任何成员（不能是执行人自己） |

请求示例（认领任务）：
```json
{ "status": "DOING" }
```

请求示例（提交审核）：
```json
{ "status": "REVIEW" }
```

返回示例：
```json
{ "message": "任务已更新" }
```

> 错误：`400` 非法状态流转 / `403` 无权操作

---

### 3.5 删除任务

```
DELETE /api/tasks/:id
```

需要 Header：`Authorization: Bearer <token>`（需为项目成员）

返回示例：
```json
{ "message": "任务已删除" }
```

> 说明：软删除（`is_deleted = true`），不会物理删除数据

---

### 3.6 审核任务

```
PATCH /api/tasks/:id/review
```

需要 Header：`Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| action | string | 是 | `"DONE"` 通过，`"DOING"` 打回 |

请求示例：
```json
{ "action": "DONE" }
```

返回示例：
```json
{ "message": "审核通过" }
```

> 错误：`400` 任务不在 REVIEW 状态 / `403` 不能审核自己执行的任务

---

## 四、Milestone（里程碑）

### 4.1 创建里程碑

```
POST /api/projects/:id/milestones
```

需要 Header：`Authorization: Bearer <token>`（需为项目成员）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 是 | 标题，1-100 字符 |
| description | string | 否 | 描述 |
| due_date | string | 是 | 截止日期，ISO 8601 格式 |

请求示例：
```json
{
  "title": "第一阶段：需求分析",
  "description": "完成需求文档和原型图",
  "due_date": "2026-06-20"
}
```

返回示例：
```json
{ "milestone_id": 1, "title": "第一阶段：需求分析" }
```

---

### 4.2 更新里程碑

```
PATCH /api/milestones/:id
```

需要 Header：`Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 否 | 新标题 |
| description | string | 否 | 新描述 |
| due_date | string | 否 | 新截止日期 |

**注意：不可手动修改 status**，里程碑状态由系统自动管理。

返回示例：
```json
{ "message": "里程碑已更新" }
```

---

### 4.3 删除里程碑

```
DELETE /api/milestones/:id
```

需要 Header：`Authorization: Bearer <token>`（需为项目成员）

> 说明：软删除里程碑，同时将该里程碑下所有 task 的 `milestone_id` 置为 `null`。task 本身不受影响。

返回示例：
```json
{ "message": "里程碑已删除" }
```

---

### 4.4 完成里程碑

```
POST /api/milestones/:id/complete
```

需要 Header：`Authorization: Bearer <token>`

**校验规则：**
- 里程碑下至少有一个任务
- 所有任务的状态必须为 `DONE`

返回示例：
```json
{ "message": "里程碑已完成" }
```

> 错误：`400` 还有 X 个任务未完成：<任务名列表> / `400` 里程碑下没有任务

---

## 五、Tag（标签）

### 5.1 获取所有标签

```
GET /api/tags
```

返回示例：
```json
[
  { "tag_id": 1, "name": "Python" },
  { "tag_id": 2, "name": "Java" },
  { "tag_id": 3, "name": "JavaScript" }
]
```

> 说明：标签为预设值，用户不可自定义新增

---

### 5.2 获取我的技能标签

```
GET /api/users/me/tags
```

需要 Header：`Authorization: Bearer <token>`

返回示例：
```json
[
  { "tag_id": 1, "name": "Python" },
  { "tag_id": 5, "name": "React" }
]
```

---

### 5.3 设置我的技能标签

```
PUT /api/users/me/tags
```

需要 Header：`Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| tag_ids | int[] | 是 | 标签 ID 数组（替换式，非追加） |

请求示例：
```json
{
  "tag_ids": [1, 3, 5]
}
```

返回示例：
```json
[
  { "tag_id": 1, "name": "Python" },
  { "tag_id": 3, "name": "JavaScript" },
  { "tag_id": 5, "name": "React" }
]
```

---

## 附录：CRUD 实现矩阵

| 模块 | 增（Create） | 删（Delete） | 改（Update） | 查（Read） |
|---|---|---|---|---|
| **项目** | `POST /projects` | 状态改为 CLOSED 即关闭 | `PATCH /projects/:id`（标题/描述/状态/标签/截止日） | `GET /projects`（大厅）、`GET /projects/:id`（详情） |
| **任务** | `POST /projects/:id/tasks` | `DELETE /tasks/:id`（软删除） | `PATCH /tasks/:id`（标题/描述/状态/权重/指派人/里程碑/截止日）、`PATCH /tasks/:id/review`（审核） | `GET /projects/:id/tasks`、`GET /tasks/:id` |
| **里程碑** | `POST /projects/:id/milestones` | `DELETE /milestones/:id`（软删除 + 关联 task 置 NULL） | `PATCH /milestones/:id`（标题/描述/截止日）、`POST /milestones/:id/complete`（完成） | 内嵌于 `GET /projects/:id` |

## 附录：接口速查表

| 方法 | 路径 | 需 Token | 说明 |
|---|---|---|---|
| POST | `/auth/register` | — | 注册 |
| POST | `/auth/login` | — | 登录 |
| GET | `/auth/me` | 需要 | 当前用户 |
| GET | `/projects` | — | 项目大厅 |
| GET | `/projects/:id` | — | 项目详情 |
| POST | `/projects` | 需要 | 创建项目 |
| PATCH | `/projects/:id` | 需要 | 修改项目 |
| POST | `/projects/:id/apply` | 需要 | 申请加入 |
| PATCH | `/projects/:id/members/:userId` | 需要 | 审批成员 |
| GET | `/projects/:id/tasks` | — | 任务列表 |
| GET | `/tasks/:id` | — | 任务详情 |
| POST | `/projects/:id/tasks` | 需要 | 创建任务 |
| PATCH | `/tasks/:id` | 需要 | 更新任务 |
| DELETE | `/tasks/:id` | 需要 | 删除任务 |
| PATCH | `/tasks/:id/review` | 需要 | 审核任务 |
| POST | `/projects/:id/milestones` | 需要 | 创建里程碑 |
| PATCH | `/milestones/:id` | 需要 | 更新里程碑 |
| DELETE | `/milestones/:id` | 需要 | 删除里程碑 |
| POST | `/milestones/:id/complete` | 需要 | 完成里程碑 |
| GET | `/tags` | — | 标签列表 |
| GET | `/users/me/tags` | 需要 | 我的标签 |
| PUT | `/users/me/tags` | 需要 | 设置标签 |

---

## 附录：预设标签清单

| ID | 标签名 |
|---|---|
| 1 | Python |
| 2 | Java |
| 3 | JavaScript |
| 4 | TypeScript |
| 5 | React |
| 6 | Vue |
| 7 | Node.js |
| 8 | Spring Boot |
| 9 | Git |
| 10 | MySQL |
| 11 | MongoDB |
| 12 | Figma |
| 13 | UI 设计 |
| 14 | 测试 |
| 15 | 文档写作 |
| 16 | 项目管理 |
| 17 | 数据分析 |
| 18 | Linux |