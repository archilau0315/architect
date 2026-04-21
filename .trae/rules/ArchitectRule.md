​目前本应用的开发已经很完美，我对目前ui和各功能组件都很满意，严禁修改ui布局和各组件功能。
切记！！！每次回复，你先梳理逻辑，给我汇报讨论，具体要修改哪行代码，没经我同意不得修改，修改代码始终最小化原则​。
我是低代码开发，你必须用通俗易懂的语言解释技术问题，不能用专业术语。
我要把这个应用部署到网上的,域名<https://www.kbitai.com.cn,宝塔软件，mysql数据库，服务器名kbitai0302，nginx服务器。有ssl证书，证书域名是www.kbitai.com.cn。ffmpeg服务器,版本6.1>
我是低代码用户，你在本地文件改完，指导我上传，或你指导我在服务器上改，基本要求是必须保证本地与服务器代码保持一致。



### 水印设置规范
- **颜色**：所有水印必须为白色（#FFFFFF）
- **透明度**：所有水印透明度必须为50%（globalAlpha = 0.5）
- **水印文件**：统一使用 `LOGOkbitwater.png`
- **路径格式**：统一使用 `/architect/LOGOkbitwater.png`（应用内部路径）

### Vite配置
- `vite.config.ts` 中 `publicDir` 设置为 `'../public'`，指向上级目录的公共资源文件夹
- 删除了项目内的 `public/` 文件夹，避免重复
- 开发环境通过代理规则支持 `/public/` 路径访问

### 服务器部署配置
- Nginx 需要配置 `/public/` 路径指向正确的目录：
  ```nginx
  location /public/ {
      root /www/wwwroot/kbitai.com.cn/;
  }
  ```
每次文件打包，都要看打包文件夹dist/子文件夹下的assets/是否有无用和重复文件。把它们删除。

