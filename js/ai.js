/**
 * AI 服务模块 - DeepSeek API
 */
const AIService = {
    API_URL: 'https://api.deepseek.com/chat/completions',
    DEFAULT_API_KEY: '',
    MODEL: 'deepseek-v4-flash',

    getApiKey() {
        return localStorage.getItem('ai_api_key') || this.DEFAULT_API_KEY;
    },

    setApiKey(key) {
        localStorage.setItem('ai_api_key', key);
    },

    hasApiKey() {
        return !!this.getApiKey();
    },

    async chat(messages, temperature = 0.8, max_tokens = 500) {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error('未配置 API Key');

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: this.MODEL,
                messages,
                temperature,
                max_tokens
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            let errMsg = `AI请求失败: ${response.status}`;
            try {
                const errJson = JSON.parse(errText);
                errMsg = errJson.error?.message || errMsg;
            } catch(e) {}
            throw new Error(errMsg);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('AI返回格式异常，请稍后重试');
        }
        return data.choices[0].message.content.trim();
    },

    // 智能菜品命名
    async generateDishName(ingredients, category) {
        return await this.chat([
            { role: 'system', content: '你是流水席菜品命名专家。根据用户给的食材和分类，生成3个吉利好听的菜名。规则：1.名字2-4个字 2.用四字成语或吉祥词 3.必须和食材相关 4.只输出JSON数组 不要任何其他文字 标点 符号 说明' },
            { role: 'user', content: `食材:${ingredients} 分类:${category}` }
        ], 0.3, 100);
    },

    // 客户确认话术
    async generateConfirmMessage(order) {
        let dateStr = '待定';
        if (order.date) {
            try {
                const d = new Date(order.date);
                const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
                dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（周${weekDays[d.getDay()]}）`;
            } catch(e) {}
        }

        const dishNames = order.dishNames || [];
        const pkgInfo = order.packageName ? `套餐：${order.packageName}` : '定制套餐';

        return await this.chat([
            { role: 'system', content: `你是一位中国农村流水席团队的客服助手。请根据订单信息生成一段发给客户的微信确认话术。
要求：
1. 语气热情亲切，像邻居说话一样自然
2. 开头要有称呼（用客户姓名，如"王哥"、"李姐"）
3. 必须包含：日期、席数（写明"X备Y"）、菜品数量
4. 如果有价格就写上，没有就不提
5. 提醒客户：如有加桌/减桌/改菜等变动请提前2天联系
6. 结尾加上厨师联系方式占位符"如有疑问请联系：XXX"
7. 不要用markdown格式，直接输出可以复制的纯文本
8. 控制在100字以内，简洁明了` },
            { role: 'user', content: `请根据以下订单信息生成确认话术：
客户姓名：${order.customerName || '客户'}
联系电话：${order.phone || '未提供'}
宴席日期：${dateStr}
席数：${order.mainTables || 0}席（另备${order.backupTables || 0}席）
${pkgInfo}
菜品：${dishNames.length > 0 ? dishNames.join('、') : '按套餐标准'}
每席价格：${order.perTablePrice ? order.perTablePrice + '元' : '面议'}
总价：${order.totalPrice ? order.totalPrice + '元' : '按实际结算'}
${order.notes ? '客户备注：' + order.notes : ''}
厨师：何朝斌` }
        ]);
    },

    // 客户画像分析（保留兼容）
    async analyzeCustomer(customer) {
        const ordersText = customer.orders.map((o, i) => {
            return `订单${i+1}：${o.date}，${o.package}，${o.tables}备${o.backup}席，总价${o.price}元，菜品：${o.dishes.join('、') || '按套餐'}${o.address ? '，地址：' + o.address : ''}`;
        }).join('\n');

        return await this.chat([
            { role: 'system', content: `你是流水席经营分析专家。根据客户历史订单，分析偏好并给出建议。分4部分：【消费能力】【规模偏好】【菜品偏好】【推荐策略】。每条不超过15字。纯文本，150字以内。` },
            { role: 'user', content: `客户：${customer.name}\n订单数：${customer.orderCount}笔\n\n历史订单：\n${ordersText}` }
        ], 0.5, 300);
    },

    // 分析所有客户 & 菜品优化 - 返回结构化JSON
    async analyzeAllCustomers(data) {
        const { orders, topDishes, monthlyStats, dishCount, packageCount, dishLibrary, neverOrdered, avgPrice, avgTables, totalRevenue } = data;

        const ordersText = orders.slice(0, 20).map((o, i) => {
            const dishNames = o.dishes.map(d => d.name).join('、');
            return `${i+1}. ${o.date} ${o.packageName} ${o.tables}席 ¥${o.price} [${dishNames}]`;
        }).join('\n');

        const dishLibraryText = dishLibrary.map(d => `${d.name}(${d.category})`).join('、');

        const raw = await this.chat([
            { role: 'system', content: `你是流水席经营数据分析师。根据订单数据，生成经营分析报告。

你必须严格输出以下JSON格式，不要输出任何其他文字：
{
  "summary": "一句话总结整体经营状况（20字以内）",
  "metrics": {
    "totalOrders": ${orders.length},
    "totalRevenue": ${totalRevenue || 0},
    "avgPrice": ${avgPrice || 0},
    "avgTables": ${avgTables || 0}
  },
  "highlights": [
    {"icon": "trending_up", "title": "标题", "desc": "描述", "color": "#C45C48"}
  ],
  "topDishes": [
    {"name": "菜名", "count": 0, "tag": "标签如必点/人气王"}
  ],
  "coldDishes": [
    {"name": "菜名", "reason": "为什么没人点"}
  ],
  "suggestions": [
    {"type": "add|remove|push", "dish": "菜名", "reason": "原因"}
  ]
}

分析要求：
1. highlights: 3-4个关键发现，用数据说话（如"本月营收增长30%"）
2. topDishes: 从实际数据中提取TOP5，给每个菜打标签
3. coldDishes: 从从未被点过的菜品中分析原因
4. suggestions: 具体到菜名的建议，type为add(新增)/remove(删减)/push(主推)
5. 所有分析必须基于提供的数据，不要编造数据` },
            { role: 'user', content: `经营数据：
- 总订单：${orders.length}单
- 菜品库：${dishCount}道菜，${packageCount}个套餐
- 平均客单价：¥${avgPrice || 0}
- 平均席数：${avgTables || 0}席
- 总营收：¥${totalRevenue || 0}

热门菜品TOP10：${topDishes.join('、')}
从未被点过的菜：${neverOrdered.join('、') || '无'}

菜品库：${dishLibraryText}

月度数据：
${monthlyStats || '暂无'}

订单明细（最近20单）：
${ordersText}` }
        ], 0.5, 800);

        // 解析JSON，容错处理
        try {
            // 尝试提取JSON（可能被```包裹）
            let jsonStr = raw;
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];
            return JSON.parse(jsonStr);
        } catch(e) {
            // JSON解析失败，返回原始文本
            return { summary: raw, parseError: true };
        }
    }
};
