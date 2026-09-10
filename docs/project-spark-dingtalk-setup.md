# 钉钉表单接入配置

1. 在活动发布配置中保存钉钉表单分享地址，并配置参与编号参数名（例如
   `participant`）。服务端打开表单前会保留分享地址的原有参数，并自动追加该参数。
2. 在钉钉多维表格自动化中选择“添加新记录”触发器，向
   `POST /api/integrations/dingtalk/form-submissions` 发送 HTTP 请求。
3. 请求头配置
   `Authorization: Bearer <DINGTALK_CALLBACK_SECRET>`。该值是本系统自行生成并与钉钉自动化共享的随机密钥，不是钉钉 AppSecret。密钥通过部署环境注入，不写入活动配置、URL 或日志。完整解释见[配置说明](project-spark-configuration.md)。
4. Body 固定映射 `formId`，并引用记录的 `recordId`、预填保存的
   `participationId`、姓名和手机号字段。

服务端返回 200 只表示回调和处理任务已可靠保存。后台任务完成后，活动页查询到的留资状态才会更新。重复发送同一记录安全；同一
`recordId` 不得改绑其他参与编号。

未收到回调时，先在钉钉自动化执行记录中确认触发条件、HTTP 状态和字段映射。服务端无法恢复从未送达的请求；修正配置后应从钉钉侧重发该记录。失败任务可在管理后台查看并重试。
