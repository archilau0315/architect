<?php
/**
 * 首席图像架构师 - API代理控制器
 * 安全地代理第三方API请求，隐藏API Key
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

namespace KbitArchitect\Controllers;

use KbitArchitect\Core\Database;

class ProxyController
{
    private Database $db;
    private array $apiKeys = [];

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->loadApiKeys();
    }

    private function loadApiKeys(): void
    {
        $configs = $this->db->query(
            "SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'api_key_%'"
        );
        
        foreach ($configs as $config) {
            $provider = str_replace('api_key_', '', $config['config_key']);
            $this->apiKeys[$provider] = $config['config_value'];
        }
    }

    private function getApiKey(string $provider): ?string
    {
        return $this->apiKeys[$provider] ?? null;
    }

    private function getBaseUrl(string $provider): string
    {
        $urls = [
            'ph8' => 'https://ph8.co/v1',
            'google' => 'https://generativelanguage.googleapis.com/v1beta',
            'gemini' => 'https://generativelanguage.googleapis.com/v1beta',
        ];
        return $urls[$provider] ?? 'https://ph8.co/v1';
    }

    /**
     * Gemini 聊天/文本生成代理
     */
    public function geminiChat(array $request): array
    {
        $body = $request['body'];
        $model = $body['model'] ?? 'gemini-1.5-flash';
        $contents = $body['contents'] ?? [];
        $systemInstruction = $body['systemInstruction'] ?? null;
        $maxOutputTokens = $body['maxOutputTokens'] ?? 1024;
        $temperature = $body['temperature'] ?? 0.7;

        $apiKey = $this->getApiKey('google') ?: $this->getApiKey('gemini');
        if (!$apiKey) {
            return ['success' => false, 'error' => 'Gemini API Key未配置', 'code' => 500];
        }

        $baseUrl = $this->getBaseUrl('gemini');
        $url = rtrim($baseUrl, '/') . '/models/' . $model . ':generateContent?key=' . $apiKey;

        $requestBody = [
            'contents' => $contents,
            'generationConfig' => [
                'maxOutputTokens' => $maxOutputTokens,
                'temperature' => $temperature
            ]
        ];

        if ($systemInstruction) {
            $requestBody['systemInstruction'] = $systemInstruction;
        }

        $ch = curl_init($url);
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($requestBody),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 120,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => '网络请求失败: ' . $error,
                'code' => 500
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMsg = $data['error']['message'] ?? '请求失败';
            return [
                'success' => false,
                'error' => $errorMsg,
                'code' => $httpCode,
                'data' => $data
            ];
        }

        return [
            'success' => true,
            'data' => $data
        ];
    }

    /**
     * Gemini 图像生成代理
     */
    public function geminiImageGeneration(array $request): array
    {
        $body = $request['body'];
        $model = $body['model'] ?? 'gemini-2.0-flash-exp-image-generation';
        $contents = $body['contents'] ?? [];
        $systemInstruction = $body['systemInstruction'] ?? null;
        $responseModalities = $body['responseModalities'] ?? ['IMAGE'];
        $aspectRatio = $body['aspectRatio'] ?? '1:1';

        $apiKey = $this->getApiKey('google') ?: $this->getApiKey('gemini');
        if (!$apiKey) {
            return ['success' => false, 'error' => 'Gemini API Key未配置', 'code' => 500];
        }

        $baseUrl = $this->getBaseUrl('gemini');
        $url = rtrim($baseUrl, '/') . '/models/' . $model . ':generateContent?key=' . $apiKey;

        $requestBody = [
            'contents' => $contents,
            'generationConfig' => [
                'responseModalities' => $responseModalities
            ]
        ];

        if ($systemInstruction) {
            $requestBody['systemInstruction'] = $systemInstruction;
        }

        if ($aspectRatio) {
            $requestBody['generationConfig']['aspectRatio'] = $aspectRatio;
        }

        $ch = curl_init($url);
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($requestBody),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 180,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => '网络请求失败: ' . $error,
                'code' => 500
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMsg = $data['error']['message'] ?? '请求失败';
            return [
                'success' => false,
                'error' => $errorMsg,
                'code' => $httpCode,
                'data' => $data
            ];
        }

        return [
            'success' => true,
            'data' => $data
        ];
    }

    /**
     * Gemini 视频生成代理
     */
    public function geminiVideoGeneration(array $request): array
    {
        $body = $request['body'];
        $model = $body['model'] ?? 'veo-2.0-generate-preview';
        $prompt = $body['prompt'] ?? '';
        $imageData = $body['image'] ?? null;
        $aspectRatio = $body['aspectRatio'] ?? '16:9';

        $apiKey = $this->getApiKey('google') ?: $this->getApiKey('gemini');
        if (!$apiKey) {
            return ['success' => false, 'error' => 'Gemini API Key未配置', 'code' => 500];
        }

        $baseUrl = $this->getBaseUrl('gemini');
        $url = rtrim($baseUrl, '/') . '/models/' . $model . ':generateVideos?key=' . $apiKey;

        $requestBody = [
            'prompt' => $prompt,
            'config' => [
                'aspectRatio' => $aspectRatio,
                'numberOfVideos' => 1
            ]
        ];

        if ($imageData) {
            $requestBody['image'] = [
                'imageBytes' => $imageData,
                'mimeType' => 'image/jpeg'
            ];
        }

        $ch = curl_init($url);
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($requestBody),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 300,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => '网络请求失败: ' . $error,
                'code' => 500
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMsg = $data['error']['message'] ?? '请求失败';
            return [
                'success' => false,
                'error' => $errorMsg,
                'code' => $httpCode,
                'data' => $data
            ];
        }

        return [
            'success' => true,
            'data' => $data
        ];
    }

    /**
     * 查询 Gemini 视频生成状态
     */
    public function geminiVideoStatus(array $request): array
    {
        $query = $request['query'] ?? [];
        $operationName = $query['operation'] ?? '';

        $apiKey = $this->getApiKey('google') ?: $this->getApiKey('gemini');
        if (!$apiKey) {
            return ['success' => false, 'error' => 'Gemini API Key未配置', 'code' => 500];
        }

        $baseUrl = $this->getBaseUrl('gemini');
        $url = rtrim($baseUrl, '/') . '/' . $operationName . '?key=' . $apiKey;

        $ch = curl_init($url);
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPGET => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 60,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => '网络请求失败: ' . $error,
                'code' => 500
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMsg = $data['error']['message'] ?? '请求失败';
            return [
                'success' => false,
                'error' => $errorMsg,
                'code' => $httpCode,
                'data' => $data
            ];
        }

        return [
            'success' => true,
            'data' => $data
        ];
    }

    public function imageGeneration(array $request): array
    {
        $body = $request['body'];
        $provider = $body['provider'] ?? 'ph8';
        $model = $body['model'] ?? 'gemini-3.1-flash-image-preview';
        $prompt = $body['prompt'] ?? '';
        $imageData = $body['image_data'] ?? null;
        $seed = $body['seed'] ?? mt_rand(1, 2147483647);
        $size = $body['size'] ?? '1024x1024';
        $extraBody = $body['extra_body'] ?? null;
        $contents = $body['contents'] ?? null;

        $apiKey = $this->getApiKey($provider);
        if (!$apiKey) {
            return ['success' => false, 'error' => 'API Key未配置', 'code' => 500];
        }

        $baseUrl = $this->getBaseUrl($provider);
        $url = rtrim($baseUrl, '/') . '/images/generations';

        $requestBody = [
            'model' => $model,
            'response_format' => 'b64_json',
            'n' => 1,
            'seed' => $seed
        ];

        if ($contents) {
            $requestBody['contents'] = $contents;
        }
        
        if ($prompt) {
            $requestBody['prompt'] = $prompt;
        }

        if ($imageData) {
            if (isset($body['is_inpainting']) || isset($body['is_upscale'])) {
                $requestBody['images'] = [
                    ['data' => $imageData, 'mime_type' => 'image/jpeg']
                ];
            } else {
                $requestBody['images'] = [
                    ['data' => $imageData, 'mime_type' => 'image/jpeg']
                ];
            }
        }

        if ($extraBody) {
            $requestBody['extra_body'] = $extraBody;
        }

        $ch = curl_init($url);
        
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ];

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($requestBody),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => '网络请求失败: ' . $error,
                'code' => 500
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMsg = $data['error']['message'] ?? $data['msg'] ?? '请求失败';
            return [
                'success' => false,
                'error' => $errorMsg,
                'code' => $httpCode,
                'data' => $data
            ];
        }

        if (isset($data['data'][0]['b64_json'])) {
            return [
                'success' => true,
                'data' => [
                    'image' => $data['data'][0]['b64_json'],
                    'format' => 'base64'
                ]
            ];
        }

        if (isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $part) {
                if (isset($part['inlineData']['data'])) {
                    return [
                        'success' => true,
                        'data' => [
                            'image' => $part['inlineData']['data'],
                            'format' => 'base64',
                            'mime_type' => $part['inlineData']['mimeType'] ?? 'image/png'
                        ]
                    ];
                }
            }
        }

        return [
            'success' => false,
            'error' => '无法解析响应数据',
            'code' => 500,
            'raw' => $response
        ];
    }

    public function chatCompletion(array $request): array
    {
        $body = $request['body'];
        $provider = $body['provider'] ?? 'ph8';
        $model = $body['model'] ?? 'deepseek-v3.2';
        $messages = $body['messages'] ?? [];
        $maxTokens = $body['max_tokens'] ?? 1024;

        $apiKey = $this->getApiKey($provider);
        if (!$apiKey) {
            return ['success' => false, 'error' => 'API Key未配置', 'code' => 500];
        }

        $baseUrl = $this->getBaseUrl($provider);
        $url = rtrim($baseUrl, '/') . '/chat/completions';

        $requestBody = [
            'model' => $model,
            'messages' => $messages,
            'max_tokens' => $maxTokens
        ];

        $ch = curl_init($url);
        
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ];

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($requestBody),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => '网络请求失败: ' . $error,
                'code' => 500
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMsg = $data['error']['message'] ?? $data['msg'] ?? '请求失败';
            return [
                'success' => false,
                'error' => $errorMsg,
                'code' => $httpCode
            ];
        }

        return [
            'success' => true,
            'data' => $data
        ];
    }

    public function getStatus(array $request): array
    {
        $provider = $request['query']['provider'] ?? 'ph8';
        
        return [
            'success' => true,
            'data' => [
                'provider' => $provider,
                'configured' => !empty($this->getApiKey($provider))
            ]
        ];
    }
}
