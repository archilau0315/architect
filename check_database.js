const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 服务器数据库配置
const serverConfig = {
  host: 'localhost', // 服务器地址
  user: 'kbitai0302',
  password: 'kbitai2026',
  database: 'kbitai0302',
  port: 3306
};

// 本地数据库SQL文件路径
const localSqlPath = path.join(__dirname, 'backend', 'database.sql');

// 本地控制器文件路径
const controllerPaths = [
  path.join(__dirname, 'backend', 'controllers', 'userController.js'),
  path.join(__dirname, 'backend', 'controllers', 'authController.js'),
  path.join(__dirname, 'backend', 'controllers', 'adminController.js')
];

// 解析本地SQL文件，获取表结构
function parseLocalSql() {
  const sqlContent = fs.readFileSync(localSqlPath, 'utf8');
  const tables = {};
  
  // 提取CREATE TABLE语句
  const tableMatches = sqlContent.match(/CREATE TABLE IF NOT EXISTS ([\w_]+)\s*\(([\s\S]*?)\) ENGINE=/g);
  
  if (tableMatches) {
    tableMatches.forEach(tableMatch => {
      // 提取表名
      const tableNameMatch = tableMatch.match(/CREATE TABLE IF NOT EXISTS ([\w_]+)\s*\(/);
      if (tableNameMatch) {
        const tableName = tableNameMatch[1];
        tables[tableName] = [];
        
        // 提取字段定义
        const fieldsMatch = tableMatch.match(/\(([\s\S]*?)\) ENGINE=/);
        if (fieldsMatch) {
          const fieldsContent = fieldsMatch[1];
          const fieldLines = fieldsContent.split(',\n');
          
          fieldLines.forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('PRIMARY KEY') && !line.startsWith('INDEX') && !line.startsWith('ENGINE=')) {
              const fieldMatch = line.match(/^\s*(\w+)\s+([\w\s]+)(?:\s+COMMENT\s+'([^']+)'|$)/);
              if (fieldMatch) {
                const fieldName = fieldMatch[1];
                const fieldType = fieldMatch[2].trim();
                const comment = fieldMatch[3] || '';
                tables[tableName].push({ fieldName, fieldType, comment });
              }
            }
          });
        }
      }
    });
  }
  
  return tables;
}

// 扫描控制器文件，获取使用的表名和字段
function scanControllers() {
  const controllerUsage = {};
  
  controllerPaths.forEach(controllerPath => {
    if (fs.existsSync(controllerPath)) {
      const content = fs.readFileSync(controllerPath, 'utf8');
      const controllerName = path.basename(controllerPath, '.js');
      controllerUsage[controllerName] = [];
      
      // 提取SQL查询中的表名和字段
      const queryMatches = content.match(/db\.query\([\s\S]*?\)/g);
      if (queryMatches) {
        queryMatches.forEach(query => {
          // 提取表名
          const tableMatches = query.match(/FROM\s+(`?)([\w_]+)\1|UPDATE\s+(`?)([\w_]+)\3|INSERT INTO\s+(`?)([\w_]+)\5/g);
          if (tableMatches) {
            tableMatches.forEach(tableMatch => {
              const tableName = tableMatch.replace(/FROM\s+`?|UPDATE\s+`?|INSERT INTO\s+`?|`/g, '').trim();
              if (tableName && !controllerUsage[controllerName].includes(tableName)) {
                controllerUsage[controllerName].push(tableName);
              }
            });
          }
        });
      }
    }
  });
  
  return controllerUsage;
}

// 连接服务器数据库，获取实际表结构
async function getServerTables() {
  let connection;
  try {
    connection = await mysql.createConnection(serverConfig);
    
    // 获取所有表名
    const [tables] = await connection.query(
      "SHOW TABLES IN kbitai0302"
    );
    
    const serverTables = {};
    
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      
      // 获取表结构
      const [fields] = await connection.query(
        `DESCRIBE ${tableName}`
      );
      
      serverTables[tableName] = fields.map(field => ({
        fieldName: field.Field,
        fieldType: field.Type,
        null: field.Null,
        key: field.Key,
        default: field.Default,
        extra: field.Extra
      }));
    }
    
    return serverTables;
  } catch (error) {
    console.error('连接服务器数据库失败:', error.message);
    return null;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 比较本地和服务器的表结构
function compareStructures(localTables, serverTables, controllerUsage) {
  console.log('=== 数据库结构比较报告 ===\n');
  
  // 检查服务器上存在的表
  const serverTableNames = Object.keys(serverTables || {});
  const localTableNames = Object.keys(localTables);
  
  console.log('1. 服务器上存在的表:');
  serverTableNames.forEach(tableName => {
    console.log(`   - ${tableName}`);
  });
  console.log('');
  
  console.log('2. 本地SQL中定义的表:');
  localTableNames.forEach(tableName => {
    console.log(`   - ${tableName}`);
  });
  console.log('');
  
  console.log('3. 控制器中使用的表:');
  Object.entries(controllerUsage).forEach(([controller, tables]) => {
    console.log(`   ${controller}:`);
    tables.forEach(table => {
      console.log(`     - ${table}`);
    });
  });
  console.log('');
  
  // 检查差异
  console.log('4. 差异分析:');
  
  // 服务器有但本地没有的表
  const serverOnlyTables = serverTableNames.filter(table => !localTableNames.includes(table));
  if (serverOnlyTables.length > 0) {
    console.log('   服务器有但本地SQL中没有的表:');
    serverOnlyTables.forEach(table => {
      console.log(`     - ${table}`);
    });
  }
  
  // 本地有但服务器没有的表
  const localOnlyTables = localTableNames.filter(table => !serverTableNames.includes(table));
  if (localOnlyTables.length > 0) {
    console.log('   本地SQL中有但服务器没有的表:');
    localOnlyTables.forEach(table => {
      console.log(`     - ${table}`);
    });
  }
  
  // 检查字段差异
  console.log('');
  console.log('5. 字段差异:');
  
  localTableNames.forEach(tableName => {
    if (serverTables[tableName]) {
      const localFields = localTables[tableName].map(f => f.fieldName);
      const serverFields = serverTables[tableName].map(f => f.fieldName);
      
      const localOnlyFields = localFields.filter(field => !serverFields.includes(field));
      const serverOnlyFields = serverFields.filter(field => !localFields.includes(field));
      
      if (localOnlyFields.length > 0 || serverOnlyFields.length > 0) {
        console.log(`   表 ${tableName}:`);
        
        if (localOnlyFields.length > 0) {
          console.log(`     本地有但服务器没有的字段: ${localOnlyFields.join(', ')}`);
        }
        
        if (serverOnlyFields.length > 0) {
          console.log(`     服务器有但本地没有的字段: ${serverOnlyFields.join(', ')}`);
        }
      }
    }
  });
  
  console.log('');
  console.log('6. 控制器使用检查:');
  
  // 检查控制器中使用的表是否在服务器上存在
  Object.entries(controllerUsage).forEach(([controller, tables]) => {
    tables.forEach(table => {
      if (!serverTableNames.includes(table)) {
        console.log(`   ${controller} 使用了服务器上不存在的表: ${table}`);
      }
    });
  });
  
  console.log('');
  console.log('=== 比较完成 ===');
}

// 主函数
async function main() {
  console.log('开始检查数据库结构...');
  console.log('=====================================');
  
  // 解析本地SQL
  const localTables = parseLocalSql();
  
  // 扫描控制器
  const controllerUsage = scanControllers();
  
  // 获取服务器表结构
  const serverTables = await getServerTables();
  
  if (serverTables) {
    // 比较结构
    compareStructures(localTables, serverTables, controllerUsage);
  } else {
    console.log('无法连接服务器数据库，跳过结构比较');
  }
  
  console.log('=====================================');
  console.log('检查完成');
}

// 运行
main();
