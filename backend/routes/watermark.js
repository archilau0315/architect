const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { ContentIdService } = require('../../services/contentIdService');

const UPLOAD_DIR = '/www/wwwroot/www.kbitai.com.cn/uploads';
const WATERMARK_LOGO = '/www/wwwroot/www.kbitai.com.cn/LOGOkbitwater.png';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 图片水印处理
router.post('/image', async (req, res) => {
  const { imageUrl, contentId } = req.body;
  
  if (!imageUrl) {
    return res.status(400).json({ error: '请提供图片URL' });
  }
  
  const id = contentId || ContentIdService.generateId();
  const inputPath = path.join(UPLOAD_DIR, `${id}_input.png`);
  const outputPath = path.join(UPLOAD_DIR, `${id}_output.png`);
  
  try {
    await downloadFile(imageUrl, inputPath);
    
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -i "${WATERMARK_LOGO}" -filter_complex "[1:v]scale=iw*0.15:-1,format=rgba,colorchannelmixer=aa=0.5[wm];[0:v][wm]overlay=W-w-20:H-h-20" -metadata title="AI Generated Content" -metadata comment="Platform:KBITAI|ID:${id}" -metadata software="KBITAI AI Image Architect" "${outputPath}"`;
    
    exec(ffmpegCmd, (error) => {
      if (error) {
        console.error('FFmpeg error:', error);
        return res.status(500).json({ error: '水印处理失败' });
      }
      
      fs.unlinkSync(inputPath);
      
      res.json({
        success: true,
        contentId: id,
        downloadUrl: `/uploads/${id}_output.png`
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 视频水印处理
router.post('/video', async (req, res) => {
  const { videoUrl, contentId } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ error: '请提供视频URL' });
  }
  
  const id = contentId || ContentIdService.generateId();
  const inputPath = path.join(UPLOAD_DIR, `${id}_input.mp4`);
  const outputPath = path.join(UPLOAD_DIR, `${id}_output.mp4`);
  
  try {
    await downloadFile(videoUrl, inputPath);
    
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -i "${WATERMARK_LOGO}" -filter_complex "[1:v]scale=iw*0.30:-1,format=rgba,colorchannelmixer=aa=0.5[wm];[0:v][wm]overlay=W-w-20:H-h-20" -metadata title="AI Generated Content" -metadata comment="Platform:KBITAI|ID:${id}" -metadata software="KBITAI AI Image Architect" -c:v libx264 -preset fast -c:a copy "${outputPath}"`;
    
    exec(ffmpegCmd, (error) => {
      if (error) {
        console.error('FFmpeg error:', error);
        return res.status(500).json({ error: '水印处理失败' });
      }
      
      fs.unlinkSync(inputPath);
      
      res.json({
        success: true,
        contentId: id,
        downloadUrl: `/uploads/${id}_output.mp4`
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 下载文件
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

module.exports = router;
