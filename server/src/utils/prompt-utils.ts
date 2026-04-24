/**
 * 提示词工具函数
 * 用于处理提示词中的占位符替换
 */

/**
 * 使用括号平衡匹配从文本中提取JSON
 * 修复贪婪正则 /{[\s\S]*}/ 和 /\[[\s\S]*\]/ 可能匹配过多内容的问题
 *
 * @param text 包含JSON的文本
 * @param bracket 要匹配的括号类型: '{' 或 '['
 * @returns 匹配到的JSON字符串，或null
 */
function extractBalancedJson(text: string, bracket: '{' | '['): string | null {
  const openBracket = bracket;
  const closeBracket = bracket === '{' ? '}' : ']';

  // 查找第一个开括号的位置
  let startIndex = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === openBracket) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) return null;

  // 使用括号平衡计数提取JSON
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === openBracket) {
      depth++;
    } else if (char === closeBracket) {
      depth--;
      if (depth === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * 从LLM响应中提取JSON（支持对象和数组格式）
 * 优先匹配数组格式，其次匹配对象格式
 *
 * @param response LLM响应文本
 * @returns 提取的JSON字符串，或null
 */
export function extractJsonFromResponse(response: string): { json: string; isArray: boolean } | null {
  // 先尝试匹配数组格式
  const arrayJson = extractBalancedJson(response, '[');
  if (arrayJson) {
    return { json: arrayJson, isArray: true };
  }

  // 再尝试匹配对象格式
  const objectJson = extractBalancedJson(response, '{');
  if (objectJson) {
    return { json: objectJson, isArray: false };
  }

  return null;
}

/**
 * 替换提示词中的占位符
 * @param template 提示词模板
 * @param variables 变量对象
 * @returns 替换后的提示词
 */
export function replacePromptPlaceholders(template: string, variables: Record<string, any>): string {
  let result = template;
  
  // 替换 {{variable}} 格式的占位符
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, String(value || ''));
  });
  
  return result;
}

/**
 * 智能记账提示词变量接口
 */
export interface SmartAccountingPromptVariables {
  description: string;
  categories?: string;
  budgets?: string;
  currentDate?: string;
}

/**
 * 记账相关性判断提示词变量接口
 */
export interface RelevanceCheckPromptVariables {
  description: string;
}

/**
 * 图片分析提示词变量接口
 */
export interface ImageAnalysisPromptVariables {
  [key: string]: any; // 图片分析暂时不需要变量，但保留扩展性
}

/**
 * 智能记账提示词处理器
 */
export class SmartAccountingPromptProcessor {
  /**
   * 处理记账相关性判断提示词
   * @param template 提示词模板
   * @param variables 变量
   * @returns 处理后的提示词
   */
  static processRelevanceCheckPrompt(
    template: string,
    variables: RelevanceCheckPromptVariables
  ): string {
    return replacePromptPlaceholders(template, variables);
  }

  /**
   * 处理智能记账分析提示词
   * @param template 提示词模板
   * @param variables 变量
   * @returns 处理后的提示词
   */
  static processSmartAccountingPrompt(
    template: string,
    variables: SmartAccountingPromptVariables
  ): string {
    return replacePromptPlaceholders(template, variables);
  }

  /**
   * 处理图片分析提示词
   * @param template 提示词模板
   * @param variables 变量
   * @returns 处理后的提示词
   */
  static processImageAnalysisPrompt(
    template: string,
    variables: ImageAnalysisPromptVariables = {}
  ): string {
    return replacePromptPlaceholders(template, variables);
  }
}

/**
 * 获取所有支持的占位符说明
 * @returns 占位符说明对象
 */
export function getPlaceholderDescriptions() {
  return {
    relevanceCheck: {
      description: '记账相关性判断提示词支持的占位符',
      placeholders: {
        '{{description}}': '用户输入的描述内容'
      }
    },
    smartAccounting: {
      description: '智能记账分析提示词支持的占位符',
      placeholders: {
        '{{categories}}': '动态插入的分类列表',
        '{{budgets}}': '动态插入的预算列表',
        '{{description}}': '用户输入的记账描述',
        '{{currentDate}}': '当前日期 (YYYY-MM-DD 格式)'
      }
    },
    imageAnalysis: {
      description: '图片分析提示词支持的占位符',
      placeholders: {
        // 图片分析暂时不需要占位符，但保留扩展性
        '{{imageType}}': '图片类型（未来可能支持）',
        '{{analysisMode}}': '分析模式（未来可能支持）'
      }
    }
  };
}