// 错误处理服务

// 检查是否是权限错误
export const isPermissionError = (err: any): boolean => {
  const msg = (err.message || "").toLowerCase();
  return msg.includes("permission") || 
         msg.includes("403") || 
         msg.includes("forbidden") || 
         msg.includes("not enabled") || 
         msg.includes("not found");
};

// 检查是否是配额错误
export const isQuotaError = (err: any): boolean => {
  const msg = (err.message || "").toLowerCase();
  return msg.includes("quota") || 
         msg.includes("exhausted") ||
         msg.includes("resource_exhausted");
};

// 检查是否是速率限制错误
export const isRateLimitError = (err: any): boolean => {
  const msg = (err.message || "").toLowerCase();
  return msg.includes("429") || 
         msg.includes("rate limit") ||
         msg.includes("too many requests");
};

// 格式化错误信息
export const formatError = (err: any, useThirdPartyGateway: boolean): string => {
  const msg = (err.message || "").toLowerCase();
  if (isRateLimitError(err)) {
    // 频率限制 - 请求过快
    return "请求频率过快，请稍后再试（Rate Limit）。";
  }
  if (isQuotaError(err)) {
    // 配额耗尽
    if (useThirdPartyGateway) {
      return "API 额度已耗尽，请检查第三方服务商余额或稍后再试。";
    } else {
      return "Google API 配额已耗尽，请检查 API Key 配额或稍后再试。";
    }
  }
  if (isPermissionError(err)) {
    return "API 访问权限被拒绝，请检查 API Key 是否有效或模型是否已启用。";
  }
  return err.message || "未知 API 错误";
};

// 安全解析JSON
export const parseJsonSafely = (text: string): any => {
  try {
    let cleaned = text.replace(/```json\n?|```/g, "").trim();
    if (cleaned.startsWith("{") && !cleaned.endsWith("}")) {
      if (cleaned.endsWith('"')) cleaned += "}";
      else cleaned += '"}';
    }
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse error:", e, "Original text:", text);
    return {};
  }
};
