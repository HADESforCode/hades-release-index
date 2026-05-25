# hades-release-index

## 仓库职责

- 公开保存多产品最新发布元数据
- 聚合输出根目录 `manifest.json`
- 通过本仓 `GitHub Releases assets` 提供安装包公开下载地址
- 不保存私有源码，不引入数据库或后端服务

## 目录结构

```text
entries/
manifest.json
schema/
scripts/
.github/workflows/
```

## 如何本地验证

```bash
npm install
npm test
npm run build
npm run validate
```

## 主站公开地址

```text
https://raw.githubusercontent.com/HADESforCode/hades-release-index/main/manifest.json
```

## 如何让产品私仓更新这个仓库

1. 私仓构建安装包
2. 私仓向本仓对应 release 上传 `GitHub Releases assets`
3. 私仓生成并提交 `entries/<slug>.json`
4. 本仓 CI 重新生成并校验 `manifest.json`

## 需要手工配置的 secrets 或仓库设置

- 公共仓启用 GitHub Actions
- 公共仓默认分支确认使用 `main`
- 私仓配置一个可写本公共仓 contents 和 releases 的 token
