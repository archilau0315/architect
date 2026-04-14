const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const { ContentIdService } = require('../services/contentIdService');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const id = ContentIdService.generateId();
    cb(null, `${id}_input${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage: storage });

// 允许的图片/视频来源域名白名单
const ALLOWED_HOSTS = ['kbitai.com.cn', 'api.kbitai.com.cn', 'storage.googleapis.com', 'firebasestorage.googleapis.com'];

function validateUrl(url) {
  try {
    const u = new URL(url);
    // 允许 blob URL（前端生成的临时文件）
    if (u.protocol === 'blob:') return true;
    if (u.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}

function validateId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

const UPLOAD_DIR = '/www/wwwroot/www.kbitai.com.cn/uploads';
const WATERMARK_LOGO = '/www/wwwroot/www.kbitai.com.cn/LOGOkbitwater.png';
const VIDEO_WATERMARK_LOGO = '/www/wwwroot/www.kbitai.com.cn/public/LOGOkbitwater.png';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 图片水印处理
router.post('/image', async (req, res) => {
  const { imageUrl, contentId } = req.body;

  if (!imageUrl || !validateUrl(imageUrl)) {
    return res.status(400).json({ error: '请提供合法的图片URL' });
  }

  const id = contentId && validateId(contentId) ? contentId : ContentIdService.generateId();
  const inputPath = path.join(UPLOAD_DIR, `${id}_input.png`);
  const outputPath = path.join(UPLOAD_DIR, `${id}_output.png`);

  try {
    await downloadFile(imageUrl, inputPath);

    const args = [
      '-y', '-i', inputPath, '-i', WATERMARK_LOGO,
      '-filter_complex', '[1:v]scale=iw*0.15:-1,format=rgba,colorchannelmixer=aa=0.5[wm];[0:v][wm]overlay=W-w-20:H-h-20',
      '-metadata', 'title=AI Generated Content',
      '-metadata', `comment=Platform:KBITAI|ID:${id}`,
      '-metadata', 'software=KBITAI AI Image Architect',
      outputPath
    ];

    execFile('ffmpeg', args, (error) => {
      fs.unlink(inputPath, () => {});
      if (error) {
        console.error('FFmpeg error:', error);
        return res.status(500).json({ error: '水印处理失败' });
      }
      res.json({ success: true, contentId: id, downloadUrl: `/uploads/${id}_output.png` });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 视频水印处理（通过 URL）
router.post('/video', async (req, res) => {
  const { videoUrl, contentId } = req.body;

  if (!videoUrl || !validateUrl(videoUrl)) {
    return res.status(400).json({ error: '请提供合法的视频URL' });
  }

  // 如果是 blob URL，返回错误提示前端上传文件
  if (videoUrl.startsWith('blob:')) {
    return res.status(400).json({ error: 'blob URL 不支持，请使用文件上传接口' });
  }

  const id = contentId && validateId(contentId) ? contentId : ContentIdService.generateId();
  const inputPath = path.join(UPLOAD_DIR, `${id}_input.mp4`);
  const outputPath = path.join(UPLOAD_DIR, `${id}_output.mp4`);

  try {
    await downloadFile(videoUrl, inputPath);

    const args = [
      '-y', '-i', inputPath, '-i', VIDEO_WATERMARK_LOGO,
      '-filter_complex', '[1:v]scale=iw*0.30:-1,format=rgba,colorchannelmixer=aa=0.5[wm];[0:v][wm]overlay=W-w-20:H-h-20',
      '-metadata', 'title=AI Generated Content',
      '-metadata', `comment=Platform:KBITAI|ID:${id}`,
      '-metadata', 'software=KBITAI AI Image Architect',
      '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'copy',
      outputPath
    ];

    execFile('ffmpeg', args, (error) => {
      fs.unlink(inputPath, () => {});
      if (error) {
        console.error('FFmpeg error:', error);
        return res.status(500).json({ error: '水印处理失败' });
      }
      res.json({ success: true, contentId: id, downloadUrl: `/uploads/${id}_output.mp4` });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 视频水印处理（通过文件上传）
router.post('/video/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传视频文件' });
  }

  const inputPath = req.file.path;
  const id = path.basename(inputPath).replace('_input.mp4', '');
  const outputPath = path.join(UPLOAD_DIR, `${id}_output.mp4`);

  try {
    const args = [
      '-y', '-i', inputPath, '-i', VIDEO_WATERMARK_LOGO,
      '-filter_complex', '[1:v]scale=iw*0.30:-1,format=rgba,colorchannelmixer=aa=0.5[wm];[0:v][wm]overlay=W-w-20:H-h-20',
      '-metadata', 'title=AI Generated Content',
      '-metadata', `comment=Platform:KBITAI|ID:${id}`,
      '-metadata', 'software=KBITAI AI Image Architect',
      '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'copy',
      outputPath
    ];

    execFile('ffmpeg', args, (error) => {
      fs.unlink(inputPath, () => {});
      if (error) {
        console.error('FFmpeg error:', error);
        return res.status(500).json({ error: '水印处理失败' });
      }
      res.json({ success: true, contentId: id, downloadUrl: `/uploads/${id}_output.mp4` });
    });
  } catch (err) {
    console.error(err);
    fs.unlink(inputPath, () => {});
    res.status(500).json({ error: '服务器错误' });
  }
});

// 下载文件（仅支持 https，已通过 validateUrl 校验）
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`下载失败，HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

module.exports = router;
