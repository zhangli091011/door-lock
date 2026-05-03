# 数据访问层文档 (Data Access Layer Documentation)

## 概述 (Overview)

本数据访问层为ESP32 NFC云门禁系统提供统一的数据库操作接口，支持SQLite和PostgreSQL两种数据库。采用Repository模式实现，提供类型安全的TypeScript接口。

This data access layer provides a unified database operation interface for the ESP32 NFC Cloud Access Control System, supporting both SQLite and PostgreSQL databases. Implemented using the Repository pattern with type-safe TypeScript interfaces.

## 架构 (Architecture)

```
src/
├── db.ts                          # 数据库连接管理 (Database connection management)
├── models/                        # 数据模型定义 (Data model definitions)
│   ├── Card.ts                    # 卡片模型
│   ├── Device.ts                  # 设备模型
│   ├── AccessLog.ts               # 访问日志模型
│   ├── Admin.ts                   # 管理员模型
│   └── index.ts                   # 模型导出
├── repositories/                  # 数据访问层 (Data access layer)
│   ├── CardRepository.ts          # 卡片仓储
│   ├── DeviceRepository.ts        # 设备仓储
│   ├── AccessLogRepository.ts     # 访问日志仓储
│   ├── AdminRepository.ts         # 管理员仓储
│   └── index.ts                   # 仓储导出
└── example-usage.ts               # 使用示例 (Usage examples)
```

## 核心组件 (Core Components)

### 1. Database 类 (Database Class)

数据库连接管理类，提供统一的查询接口。

**主要方法:**

- `query(sql, params)` - 执行查询并返回结果集
- `queryOne(sql, params)` - 执行查询并返回单行结果
- `execute(sql, params)` - 执行INSERT/UPDATE/DELETE操作
- `beginTransaction()` - 开始事务
- `commit()` - 提交事务
- `rollback()` - 回滚事务
- `close()` - 关闭数据库连接

**初始化示例:**

```typescript
import { Database, DatabaseType, createDatabaseFromEnv } from './db';

// 方式1: 从环境变量创建
const db = createDatabaseFromEnv();

// 方式2: SQLite配置
const dbSqlite = new Database({
  type: DatabaseType.SQLITE,
  sqlitePath: './data/access_control.db',
});

// 方式3: PostgreSQL配置
const dbPostgres = new Database({
  type: DatabaseType.POSTGRESQL,
  postgresUrl: 'postgresql://user:password@localhost:5432/access_control',
});
```

### 2. CardRepository (卡片仓储)

管理NFC卡片的CRUD操作。

**主要方法:**

- `findByUid(uid)` - 根据UID查找卡片
- `findAll(filter)` - 查询卡片列表（支持分页和筛选）
- `create(input)` - 创建新卡片
- `update(uid, input)` - 更新卡片信息
- `delete(uid)` - 删除卡片
- `exists(uid)` - 检查卡片是否存在
- `countEnabled()` - 统计启用的卡片数量
- `countTotal()` - 统计总卡片数量

**使用示例:**

```typescript
import { CardRepository } from './repositories';

const cardRepo = new CardRepository(db);

// 创建卡片
const card = await cardRepo.create({
  uid: '04A1B2C3D4E5F6',
  name: '张三',
  enabled: true,
  cacheable: true,
  time_slots: JSON.stringify(['09:00-12:00', '14:00-18:00']),
  allowed_devices: JSON.stringify(['door_1']),
});

// 查询卡片
const foundCard = await cardRepo.findByUid('04A1B2C3D4E5F6');

// 更新卡片
await cardRepo.update('04A1B2C3D4E5F6', {
  enabled: false,
});

// 分页查询
const result = await cardRepo.findAll({
  enabled: true,
  search: '张',
  page: 1,
  limit: 20,
});
```

### 3. DeviceRepository (设备仓储)

管理ESP32设备的CRUD操作。

**主要方法:**

- `findById(deviceId)` - 根据设备ID查找设备
- `findByApiKey(apiKey)` - 根据API Key查找设备
- `findAll()` - 查询所有设备
- `findAllWithStatus()` - 查询所有设备（包含在线状态）
- `create(input)` - 创建新设备
- `update(deviceId, input)` - 更新设备信息
- `updateLastSeen(deviceId)` - 更新设备最后在线时间
- `delete(deviceId)` - 删除设备
- `countOnline()` - 统计在线设备数量
- `countTotal()` - 统计总设备数量

**使用示例:**

```typescript
import { DeviceRepository } from './repositories';

const deviceRepo = new DeviceRepository(db);

// 创建设备
const device = await deviceRepo.create({
  device_id: 'door_1',
  name: '前门门禁',
  location: '一楼大厅',
  mac_address: 'A4:CF:12:34:56:78',
  api_key: 'sk_live_example_api_key',
  secret_key: 'secret_example_key',
  enabled: true,
});

// 更新设备在线时间
await deviceRepo.updateLastSeen('door_1');

// 查询在线设备
const devicesWithStatus = await deviceRepo.findAllWithStatus();
```

### 4. AccessLogRepository (访问日志仓储)

管理访问日志的插入和查询操作。

**主要方法:**

- `create(input)` - 创建访问日志
- `findById(id)` - 根据ID查找日志
- `findAll(filter)` - 查询日志列表（支持分页和筛选）
- `findRecent(limit)` - 查询最近的日志
- `getTodayStatistics()` - 获取今日统计数据
- `countByDevice(deviceId, startTime, endTime)` - 按设备统计访问次数
- `countByCard(uid, startTime, endTime)` - 按卡片统计访问次数
- `deleteOldLogs(beforeDate)` - 删除旧日志

**使用示例:**

```typescript
import { AccessLogRepository } from './repositories';

const accessLogRepo = new AccessLogRepository(db);

// 创建访问日志
const log = await accessLogRepo.create({
  uid: '04A1B2C3D4E5F6',
  device_id: 'door_1',
  allowed: true,
  source: 'cloud',
  card_name: '张三',
  device_name: '前门门禁',
});

// 查询最近日志
const recentLogs = await accessLogRepo.findRecent(10);

// 获取今日统计
const stats = await accessLogRepo.getTodayStatistics();
// { today_access: 120, today_denied: 5, total_access: 5000 }

// 筛选查询
const result = await accessLogRepo.findAll({
  device_id: 'door_1',
  allowed: true,
  start_time: new Date('2024-01-01'),
  end_time: new Date('2024-01-31'),
  page: 1,
  limit: 50,
});
```

### 5. AdminRepository (管理员仓储)

管理管理员账户的查询操作。

**主要方法:**

- `findByUsername(username)` - 根据用户名查找管理员
- `findById(id)` - 根据ID查找管理员
- `findAll()` - 查询所有管理员
- `exists(username)` - 检查管理员是否存在
- `toSafeAdmin(admin)` - 转换为安全的管理员对象（不含密码哈希）

**使用示例:**

```typescript
import { AdminRepository } from './repositories';

const adminRepo = new AdminRepository(db);

// 查找管理员（用于登录验证）
const admin = await adminRepo.findByUsername('admin');

// 转换为安全对象（用于API响应）
if (admin) {
  const safeAdmin = adminRepo.toSafeAdmin(admin);
  // { id: 1, username: 'admin', email: 'admin@example.com', created_at: ... }
}
```

## 数据库切换 (Database Switching)

系统支持通过环境变量切换数据库类型：

### SQLite 配置

```bash
# .env
DB_TYPE=sqlite
DATABASE_PATH=./data/access_control.db
```

### PostgreSQL 配置

```bash
# .env
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/access_control

# 或者分开配置
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=access_control
DB_USER=access_user
DB_PASSWORD=your_password
```

## 事务处理 (Transaction Handling)

```typescript
const db = createDatabaseFromEnv();

try {
  await db.beginTransaction();

  // 执行多个操作
  await cardRepo.create({ ... });
  await accessLogRepo.create({ ... });

  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.close();
}
```

## 错误处理 (Error Handling)

所有仓储方法都会抛出异常，建议使用try-catch处理：

```typescript
try {
  const card = await cardRepo.findByUid('04A1B2C3D4E5F6');
  if (!card) {
    console.log('Card not found');
  }
} catch (error) {
  console.error('Database error:', error);
}
```

## 类型安全 (Type Safety)

所有模型和接口都提供完整的TypeScript类型定义：

```typescript
import { Card, CreateCardInput, UpdateCardInput } from './models';

// 创建输入类型检查
const input: CreateCardInput = {
  uid: '04A1B2C3D4E5F6',
  name: '张三',
  enabled: true,
  cacheable: true,
};

// 返回类型自动推断
const card: Card = await cardRepo.create(input);
```

## 性能优化 (Performance Optimization)

1. **索引优化**: 数据库schema已创建必要的索引
2. **分页查询**: 所有列表查询都支持分页
3. **连接池**: PostgreSQL使用连接池管理
4. **批量操作**: 使用事务进行批量操作

## 测试建议 (Testing Recommendations)

```typescript
import { Database, DatabaseType } from './db';
import { CardRepository } from './repositories';

describe('CardRepository', () => {
  let db: Database;
  let cardRepo: CardRepository;

  beforeAll(async () => {
    // 使用内存数据库进行测试
    db = new Database({
      type: DatabaseType.SQLITE,
      sqlitePath: ':memory:',
    });
    cardRepo = new CardRepository(db);
  });

  afterAll(async () => {
    await db.close();
  });

  test('should create and find card', async () => {
    const card = await cardRepo.create({
      uid: '04A1B2C3D4E5F6',
      name: '张三',
    });
    
    const found = await cardRepo.findByUid('04A1B2C3D4E5F6');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('张三');
  });
});
```

## 注意事项 (Notes)

1. **布尔值处理**: SQLite使用0/1表示布尔值，仓储层自动转换
2. **日期处理**: 所有日期都转换为JavaScript Date对象
3. **JSON字段**: time_slots和allowed_devices存储为JSON字符串
4. **NULL值**: 可选字段使用null而不是undefined
5. **连接管理**: 使用完毕后记得调用db.close()关闭连接

## 相关文档 (Related Documentation)

- [数据库Schema](../database/README.md)
- [API设计文档](../../.kiro/specs/esp32-nfc-cloud-access-control/design.md)
- [需求文档](../../.kiro/specs/esp32-nfc-cloud-access-control/requirements.md)
