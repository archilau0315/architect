/**
 * 后端水印服务 - 在图片返回前端前添加水印
 * 方案D：后端统一处理水印，前端只能获取带水印图片
 */

const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const logger = require('./loggerService').logger;

/**
 * 判断用户是否为开发者（PRO/PLUS用户）
 * @param {string|number} userId - 用户ID
 * @param {string} userTier - 用户等级
 * @returns {boolean}
 */
function isDeveloper(userTier) {
  return userTier === 'pro' || userTier === 'plus';
}

/**
 * 从 base64 数据提取 MIME 类型
 * @param {string} base64Data - base64 编码的数据（可能有 data:image/png;base64, 前缀）
 * @returns {string} MIME 类型
 */
function getMimeType(base64Data) {
  const match = base64Data.match(/^data:([^;]+);base64,/);
  if (match) {
    return match[1];
  }
  return 'image/png';
}

/**
 * 从 base64 数据提取纯数据部分
 * @param {string} base64Data - 带前缀的 base64 数据
 * @returns {string} 纯 base64 数据
 */
function extractBase64Data(base64Data) {
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/png', data: base64Data };
}

/**
 * 添加水印到图片
 * @param {Buffer} imageBuffer - 图片原始数据
 * @param {string} logoPath - 水印Logo路径
 * @returns {Promise<Buffer>} 带水印的图片数据
 */
async function addWatermarkToBuffer(imageBuffer, logoPath) {
  try {
    // 读取原图
    const image = await Jimp.read(imageBuffer);
    const imgWidth = image.getWidth();
    const imgHeight = image.getHeight();

    // 检查Logo是否存在
    if (!fs.existsSync(logoPath)) {
      logger.warn('[水印服务] Logo文件不存在:', logoPath);
      return imageBuffer;
    }

    // 读取Logo
    const logo = await Jimp.read(logoPath);
    const logoWidth = logo.getWidth();
    const logoHeight = logo.getHeight();

    // 计算Logo大小（宽度为图片的15%，高度按比例）
    const targetLogoWidth = Math.max(80, Math.floor(imgWidth * 0.15));
    const targetLogoHeight = Math.floor((logoHeight / logoWidth) * targetLogoWidth);

    // 调整Logo大小
    logo.resize(targetLogoWidth, targetLogoHeight);

    // 设置Logo透明度 (75%)
    logo.opacity(0.75);

    // 计算Logo位置（右下角，留边距3%）
    const margin = Math.max(10, Math.floor(imgWidth * 0.03));
    const x = imgWidth - targetLogoWidth - margin;
    const y = imgHeight - targetLogoHeight - margin;

    // 合成Logo
    image.composite(logo, x, y, {
      mode: Jimp.HORIZONTAL_ALIGN_RIGHT | Jimp.VERTICAL_ALIGN_BOTTOM,
      opacitySource: 0.75,
      opacityDest: 1.0
    });

    // 转换为 Buffer
    const outputBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
    return outputBuffer;

  } catch (error) {
    logger.error('[水印服务] 添加水印失败:', error);
    return imageBuffer; // 失败时返回原图
  }
}

/**
 * 处理图片 - 根据用户权限决定是否添加水印
 * @param {string|object} imageData - base64 字符串或 JSON 对象（包含 images 数组）
 * @param {string} userTier - 用户等级
 * @param {string} logoPath - 水印Logo路径（可选，默认使用环境变量或默认路径）
 * @returns {Promise<string|object>} 处理后的图片数据
 */
async function processImage(imageData, userTier, logoPath = null) {
  // 确定Logo路径
  const defaultLogoPath = process.env.WATERMARK_LOGO_PATH || path.join(__dirname, '../../public/LOGOkbitwater.png');
  const actualLogoPath = logoPath || defaultLogoPath;

  // 开发者用户直接返回原图
  if (isDeveloper(userTier)) {
    logger.debug('[水印服务] 开发者用户，跳过水印');
    return imageData;
  }

  try {
    // 处理 JSON 对象（包含 images 数组）
    if (typeof imageData === 'object' && imageData !== null) {
      const result = { ...imageData };
      
      if (Array.isArray(result.data)) {
        result.data = await Promise.all(
          result.data.map(async (img) => {
            if (img.url) {
              const { data, mimeType } = extractBase64Data(img.url);
              const buffer = Buffer.from(data, 'base64');
              const watermarked = await addWatermarkToBuffer(buffer, actualLogoPath);
              return {
                ...img,
                url: `data:${mimeType};base64,${watermarked.toString('base64')}`
              };
            }
            return img;
          })
        );
      } else if (Array.isArray(result.images)) {
        result.images = await Promise.all(
          result.images.map(async (img) => {
            if (typeof img === 'string') {
              const { data, mimeType } = extractBase64Data(img);
              const buffer = Buffer.from(data, 'base64');
              const watermarked = await addWatermarkToBuffer(buffer, actualLogoPath);
              return `data:${mimeType};base64,${watermarked.toString('base64')}`;
            } else if (img.b64_json) {
              const buffer = Buffer.from(img.b64_json, 'base64');
              const watermarked = await addWatermarkToBuffer(buffer, actualLogoPath);
              return {
                ...img,
                b64_json: watermarked.toString('base64')
              };
            }
            return img;
          })
        );
      }
      
      return result;
    }

    // 处理纯 base64 字符串
    if (typeof imageData === 'string') {
      const { data, mimeType } = extractBase64Data(imageData);
      const buffer = Buffer.from(data, 'base64');
      const watermarked = await addWatermarkToBuffer(buffer, actualLogoPath);
      return `data:${mimeType};base64,${watermarked.toString('base64')}`;
    }

    // 其他情况返回原数据
    return imageData;

  } catch (error) {
    logger.error('[水印服务] 处理图片失败:', error);
    return imageData; // 失败时返回原图
  }
}

/**
 * 批量处理图片数组
 * @param {string[]} images - base64 图片数组
 * @param {string} userTier - 用户等级
 * @param {string} logoPath - 水印Logo路径
 * @returns {Promise<string[]>} 处理后的图片数组
 */
async function processImages(images, userTier, logoPath = null) {
  if (!Array.isArray(images)) {
    return images;
  }

  // 开发者用户直接返回
  if (isDeveloper(userTier)) {
    return images;
  }

  const defaultLogoPath = process.env.WATERMARK_LOGO_PATH || path.join(__dirname, '../../public/LOGOkbitwater.png');
  const actualLogoPath = logoPath || defaultLogoPath;

  return Promise.all(
    images.map(async (img) => {
      try {
        const { data, mimeType } = extractBase64Data(img);
        const buffer = Buffer.from(data, 'base64');
        const watermarked = await addWatermarkToBuffer(buffer, actualLogoPath);
        return `data:${mimeType};base64,${watermarked.toString('base64')}`;
      } catch (error) {
        logger.error('[水印服务] 处理单张图片失败:', error);
        return img;
      }
    })
  );
}

module.exports = {
  processImage,
  processImages,
  addWatermarkToBuffer,
  isDeveloper
};
