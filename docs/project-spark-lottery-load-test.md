# 抽奖并发基线

T10 使用真实 PostgreSQL 集成测试执行两个合格用户争抢最后一份库存，并验证只有一个事务成功、剩余库存为零、仅生成一条中奖记录。测试命令：

```bash
pnpm --filter @spark/api test:integration -- test/lottery.integration.test.ts
```

同一活动的抽奖事务按活动奖池行串行化，以确保库存条件扣减和中奖写入原子一致。吞吐上限受单次事务时长和数据库往返延迟约束；上线压测应使用与生产同规格的 PostgreSQL，记录成功吞吐、P95 奖池锁等待、序列化重试数和 `OUT_OF_STOCK` 数量。不得以本地开发机耗时作为生产容量结论。
