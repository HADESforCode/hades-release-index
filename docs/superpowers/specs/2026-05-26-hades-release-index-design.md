# HADES 多产品发布索引仓设计

## 1. 目标

在新的公共 GitHub 仓 `hades-release-index` 中建立一套“多产品发布索引”机制，用于对外公开 HADES 多个产品的最新发布元数据，并通过同一公共仓的 GitHub Releases assets 对外提供安装包下载地址。

本次设计要解决的问题：

- 多个私有产品仓会各自产出单对象 `manifest-entry.json`
- 主站 `personalPage` 最终只读取一个公开的顶层 `manifest.json`
- 当前缺少一个稳定的公共索引仓来聚合所有产品的最新发布信息
- 需要对 entry 与最终 manifest 做结构校验，避免主站读取到非法数据
- 需要一个静态、低复杂度、低攻击面的方案，不引入数据库和后端服务

## 2. 范围

本次设计包含：

- 公共索引仓的目录结构设计
- 单产品 entry 与顶层 manifest 的数据契约
- JSON Schema 与业务规则校验方案
- 聚合脚本与排序规则
- GitHub Actions 校验与构建工作流
- GitHub Raw 公开地址方案
- 私有产品仓更新本公共仓的协作方式
- GitHub Releases assets 承载安装包的规则

本次设计不包含：

- 私有产品仓内部构建安装包的具体流水线实现
- 对象存储、数据库、后台服务或上传 API
- 主站 UI 改造
- 复杂权限系统、下载鉴权或用户系统

## 3. 设计结论

推荐采用“公共索引仓保存 JSON 元数据 + 同仓 GitHub Releases assets 承载安装包 + 根目录 `manifest.json` 供主站读取”的方案：

- 仓库文件树中只保存公开 JSON、schema、脚本与 README
- 安装包二进制不提交进 Git 历史，而是上传到本仓对应 tag/release 的 assets
- 每个产品在 `entries/<slug>.json` 中只保留当前最新版本 entry
- 根目录 `manifest.json` 由脚本从 `entries/*.json` 聚合生成
- 主站 `personalPage` 只读取根目录公开 `manifest.json`
- `platforms[].downloadUrl` 指向本仓 GitHub Release asset 的公开下载地址

这样可以同时满足：

- 一个公共仓统一承载“发布索引 + 下载地址出口”
- 不把大二进制塞进 Git 历史
- 主站只消费一个静态 JSON 地址
- 不增加数据库、服务端写接口或额外部署服务

## 4. 仓库职责边界

### 4.1 本仓负责

- 保存每个产品最新公开 entry
- 聚合生成顶层 `manifest.json`
- 校验 entry 与 manifest 结构合法性
- 在 push / PR 时自动校验并重建 manifest
- 通过 GitHub Releases assets 提供安装包公开下载地址

### 4.2 本仓不负责

- 构建安装包本身
- 保存私有源码
- 提供数据库或后台 API
- 代理下载请求
- 保存每个产品所有历史 entry 文件

## 5. 目录结构

建议目录如下：

```text
hades-release-index/
  entries/
    easywrite.json
    <product-slug>.json
  manifest.json
  schema/
    product-manifest-entry.schema.json
    product-manifest.schema.json
  scripts/
    build-manifest.mjs
    lib/
      manifest-schema.mjs
  .github/
    workflows/
      validate-and-build-manifest.yml
  docs/
    superpowers/
      specs/
        2026-05-26-hades-release-index-design.md
  README.md
  package.json
```

结构说明：

- `entries/*.json`：每个产品一份单对象最新 entry
- `manifest.json`：聚合后的顶层数组，主站直接读取
- `schema/*.schema.json`：JSON Schema 定义
- `scripts/build-manifest.mjs`：扫描、校验、排序、输出 manifest
- `scripts/lib/manifest-schema.mjs`：共享 schema 加载与校验工具
- workflow：PR / push 自动校验与生成

## 6. Release 与下载资产设计

### 6.1 二进制承载方式

安装包不进入 Git 文件树，而是上传到本公共仓的 GitHub Releases assets。

原因：

- 避免 Git 历史持续膨胀
- 避免 clone / CI / PR 被大二进制拖慢
- 保持索引仓仍然以静态文本资产为主

### 6.2 Release 组织方式

推荐采用“按产品版本独立 tag/release”的方式。

示例：

- `easywrite-v0.1.4`
- `anotherproduct-v1.2.0`

规则：

- 每次某个产品发布新版本，在本仓创建一个对应 tag/release
- 该 release 只承载该产品该版本的安装包 assets
- `entries/<slug>.json` 只记录该产品当前最新版本的下载信息
- 历史版本通过历史 releases 保留，不在 `entries/` 中保留多份历史条目

### 6.3 下载地址格式

`platforms[].downloadUrl` 必须指向本仓 release asset 地址，格式如下：

```text
https://github.com/<owner>/hades-release-index/releases/download/<tag>/<fileName>
```

示例：

```text
https://github.com/HADESforCode/hades-release-index/releases/download/easywrite-v0.1.4/EasyWrite-Setup.exe
```

## 7. 数据契约

### 7.1 单产品 entry 结构

单个产品 entry 为一个 JSON 对象，字段如下：

```json
{
  "name": "EasyWrite",
  "slug": "easywrite",
  "summary": "A focused writing tool.",
  "status": "beta",
  "featured": true,
  "version": "0.1.4",
  "websiteUrl": "https://example.com/products/easywrite",
  "releaseNotesUrl": "https://github.com/HADESforCode/EasyWrite/releases/tag/v0.1.4",
  "coverImage": "/images/products/easywrite-cover.jpg",
  "updatedAt": "2026-05-25T12:00:00.000Z",
  "platforms": [
    {
      "os": "windows",
      "arch": "x64",
      "downloadUrl": "https://github.com/HADESforCode/hades-release-index/releases/download/easywrite-v0.1.4/EasyWrite-Setup.exe",
      "fileName": "EasyWrite-Setup.exe",
      "sha256": "abc123",
      "size": 12345678
    }
  ]
}
```

### 7.2 顶层 manifest 结构

根目录 `manifest.json` 为上述 entry 对象的数组：

```json
[
  {
    "name": "EasyWrite",
    "slug": "easywrite",
    "summary": "A focused writing tool.",
    "status": "beta",
    "featured": true,
    "version": "0.1.4",
    "websiteUrl": "https://example.com/products/easywrite",
    "releaseNotesUrl": "https://github.com/HADESforCode/EasyWrite/releases/tag/v0.1.4",
    "coverImage": "/images/products/easywrite-cover.jpg",
    "updatedAt": "2026-05-25T12:00:00.000Z",
    "platforms": [
      {
        "os": "windows",
        "arch": "x64",
        "downloadUrl": "https://github.com/HADESforCode/hades-release-index/releases/download/easywrite-v0.1.4/EasyWrite-Setup.exe",
        "fileName": "EasyWrite-Setup.exe",
        "sha256": "abc123",
        "size": 12345678
      }
    ]
  }
]
```

## 8. 校验规则

### 8.1 Schema 规则

通过 JSON Schema 覆盖基础结构约束：

- 顶层类型正确
- 必填字段完整
- 字段类型正确
- `status` 枚举限定为 `alpha | beta | stable | archived`
- `platforms` 为数组，且元素结构合法
- `size` 为非负整数
- URL 字段必须为合法 URI

### 8.2 业务规则

除 Schema 外，构建脚本还应执行额外业务校验：

- entry 文件名必须与 `slug` 一致
- `updatedAt` 必须能被解析为合法 ISO 时间
- `platforms` 至少包含一个平台对象
- 同一 entry 内 `(os, arch)` 组合不可重复
- `downloadUrl` 必须指向本仓 GitHub Releases download 地址
- `fileName` 必须与 `downloadUrl` 末尾文件名一致
- 最终 manifest 中 `slug` 不可重复

### 8.3 失败策略

任一 entry 非法时：

- 终止构建
- 输出明确错误信息
- 不生成错误 `manifest.json`
- CI 直接失败，阻止错误数据合入

## 9. 聚合脚本设计

`scripts/build-manifest.mjs` 负责：

1. 扫描 `entries/*.json`
2. 逐个读取并解析 entry
3. 先按单 entry schema 校验
4. 再执行业务规则校验
5. 按稳定规则排序
6. 生成根目录 `manifest.json`
7. 对最终 manifest 执行顶层 schema 校验
8. 将结果以格式化 JSON 输出到仓库根目录

### 9.1 排序规则

推荐排序规则：

- 首先按 `updatedAt` 倒序
- 若 `updatedAt` 相同，则按 `slug` 升序

这样可以兼顾：

- 主站优先展示最近更新产品
- 输出文件稳定，避免无意义抖动

### 9.2 输出规则

- `manifest.json` 始终由脚本生成，不手工维护
- 输出使用统一缩进和换行格式
- 构建脚本支持本地运行与 CI 运行

## 10. GitHub Actions 设计

### 10.1 触发条件

workflow 在以下事件触发：

- `pull_request`
- `push`

建议仅在以下路径变更时运行：

- `entries/**`
- `schema/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `.github/workflows/validate-and-build-manifest.yml`

### 10.2 工作流步骤

推荐工作流步骤：

1. checkout 代码
2. 安装 Node 依赖
3. 运行 entry / manifest 校验与聚合脚本
4. 检查工作区是否出现 `manifest.json` 差异
5. 若存在未提交差异，则失败并提示提交最新生成结果

### 10.3 行为目标

- 在 PR 阶段提前阻止非法 entry
- 保证主分支中的 `manifest.json` 始终可被主站读取
- 保证仓库中的顶层 manifest 与 `entries` 同步

## 11. 主站公开地址方案

主站默认读取 GitHub Raw 地址：

```text
https://raw.githubusercontent.com/<owner>/hades-release-index/<default-branch>/manifest.json
```

示例：

```text
https://raw.githubusercontent.com/HADESforCode/hades-release-index/main/manifest.json
```

原因：

- 配置最简单
- 不需要额外启用 Pages
- 对主站来说只是读取一个静态公开 JSON

可选升级方案：

- 后续如需更正式的静态域名，可启用 GitHub Pages
- 但首版不作为必须前置条件

## 12. 私有产品仓协作方式

### 12.1 私仓输出

每个私有产品仓负责输出：

- 安装包文件
- 单对象 `manifest-entry.json`

### 12.2 更新公共仓的推荐流程

推荐协作顺序：

1. 私有产品仓完成构建
2. 私有产品仓根据版本生成 release asset 文件名与下载 URL
3. 私有产品仓在公共仓创建或更新对应产品版本 release，并上传安装包 assets
4. 私有产品仓生成并提交 `entries/<slug>.json`
5. 公共仓 CI 自动校验并重建根目录 `manifest.json`
6. 主站继续只读取公共仓顶层 `manifest.json`

### 12.3 与主站的边界

- 主站不负责生成 manifest
- 主站不负责上传安装包
- 主站不直接访问各私有产品仓
- 主站只信任本公共仓公开的 `manifest.json`

## 13. README 需要覆盖的内容

README 至少应说明：

- 仓库职责与边界
- 目录结构说明
- entry 与 manifest 的数据契约
- 如何本地安装依赖并执行校验 / 构建
- GitHub Raw 的主站接入地址写法
- 私有产品仓如何更新该公共仓
- 本仓 GitHub Releases assets 如何组织
- 哪些 GitHub secrets / 权限配置是需要手工补充的

## 14. 手工配置项

本方案预计需要用户手工完成以下仓库配置：

### 14.1 公共仓配置

- 启用 GitHub Actions
- 确认默认分支名称，例如 `main`
- 为允许私有产品仓更新本仓，准备一个具备本仓写权限的令牌

### 14.2 私有产品仓配置

如果后续要从私仓自动更新本公共仓，私仓通常需要配置：

- 一个可写本公共仓内容与 release 的 token

该 token 至少要支持：

- 推送或提交 `entries/<slug>.json`
- 更新 `manifest.json`
- 创建或更新本公共仓 release
- 上传 release assets

### 14.3 主站配置

主站需要把公开 manifest 地址配置为：

```text
https://raw.githubusercontent.com/<owner>/hades-release-index/<default-branch>/manifest.json
```

## 15. 测试策略

首版至少覆盖以下自动化测试目标：

1. 合法 entry 能通过 schema 与业务校验
2. 非法 entry 会使构建脚本失败
3. 文件名与 slug 不一致时失败
4. 重复 `(os, arch)` 平台时报错
5. 非法 release asset URL 时报错
6. 聚合结果按 `updatedAt` 倒序、`slug` 次排序稳定输出
7. 最终 `manifest.json` 符合顶层 schema

## 16. 实施顺序

推荐实施顺序：

1. 初始化最小 Node 工程
2. 定义 entry / manifest JSON Schema
3. 实现共享校验工具
4. 实现聚合构建脚本
5. 添加示例 entry 与生成的 `manifest.json`
6. 配置 GitHub Actions 工作流
7. 编写 README

## 17. 结论

本次设计确定采用以下最终方案：

- 公共仓 `hades-release-index` 统一保存多产品最新公开元数据
- 根目录 `manifest.json` 作为主站唯一消费入口
- 安装包通过本仓 GitHub Releases assets 对外公开分发
- `entries/*.json` 只保存每个产品的最新条目
- 使用 JSON Schema + 业务规则双层校验
- 使用 GitHub Actions 在 push / PR 时自动校验并重建 manifest

该方案满足“纯静态 JSON 索引仓 + 公共下载出口 + 低复杂度 + 可扩展到多产品”的目标。
