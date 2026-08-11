# Chat Hub - GitHub 中转聊天系统

通过 GitHub 仓库作为中转站，实现内网与外网电脑之间的异步通信。

## 架构

```
内网电脑 (你) ←→ GitHub API ←→ GitHub 仓库 (中转) ←→ 外网电脑 (GPT-5)
```

## 工作原理

1. **内网**通过 GitHub API 将问题写入仓库的 `chat.md` 文件
2. **外网**定时读取 `chat.md`，获取问题
3. **外网**将问题发送给 GPT-5，获取回复
4. **外网**将回复写回 `chat.md`
5. **内网**通过 GitHub API 读取 `chat.md`，获取回复

## 配置信息

### 仓库信息

| 项目 | 值 |
|---|---|
| 仓库地址 | `https://github.com/49000910/yuancheng` |
| 中转文件 | `chat.md` |
| 分支 | `main` |

### GitHub Token

- Token: 请联系管理员获取
- 权限: `repo`（完整仓库控制）
- 生成地址: https://github.com/settings/tokens

### API 端点

```
仓库 API: https://api.github.com/repos/49000910/yuancheng
中转文件: https://api.github.com/repos/49000910/yuancheng/contents/chat.md
```

## 使用方法

### 内网（发送问题）

修改 `chat.md` 文件中的 `## Question` 部分，将问题写在下方。

### 外网（查看并回复）

1. 读取 `chat.md` 获取问题
2. 将问题提交给 GPT-5
3. 将 GPT-5 的回复写在 `## Answer` 下方
4. 保存并提交到 GitHub

### 文件格式

```markdown
# Chat Hub

## Question (from local)
[这里写问题]

## Answer (fill here)
[这里写回复]
```

## 注意

- 建议英文和数字，避免中文编码问题
- 每次对话前检查文件 SHA 避免冲突
- 外网电脑需要配置正确的 GitHub Token
