/**
 * 斌选 - 数据层
 * Mock数据和本地存储管理
 * 支持 Capacitor Native 存储
 */

// ==================== Capacitor Preferences 存储 ====================
const NativeStorage = {
    isNative: false,
    preferences: null,

    async init() {
        // 检测是否在 Capacitor 环境
        if (typeof window !== 'undefined' && window.Capacitor) {
            this.isNative = window.Capacitor.isNativePlatform();
        }
        if (this.isNative) {
            const { Preferences } = await import('@capacitor/preferences');
            this.preferences = Preferences;
        }
    },

    async get(key) {
        if (this.isNative && this.preferences) {
            const { value } = await this.preferences.get({ key });
            return value;
        }
        return localStorage.getItem(key);
    },

    async set(key, value) {
        if (this.isNative && this.preferences) {
            await this.preferences.set({ key, value });
        } else {
            localStorage.setItem(key, value);
        }
    },

    async remove(key) {
        if (this.isNative && this.preferences) {
            await this.preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    }
};

// ==================== IndexedDB 图片存储 ====================
const ImageDB = {
    DB_NAME: 'feast_images',
    DB_VERSION: 1,
    STORE_NAME: 'images',
    _db: null,

    // 打开/创建数据库
    async _open() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'dishId' });
                }
            };
            req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
            req.onerror = (e) => reject(e.target.error);
        });
    },

    // 存储图片
    async save(dishId, base64Data) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).put({ dishId, data: base64Data });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    // 读取图片
    async get(dishId) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const req = tx.objectStore(this.STORE_NAME).get(dishId);
            req.onsuccess = () => resolve(req.result ? req.result.data : null);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    // 删除图片
    async delete(dishId) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).delete(dishId);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }
};

// ==================== 常量 ====================

const STORAGE_KEYS = {
    DISHES: 'feast_dishes_v2',
    PACKAGES: 'feast_packages_v2',
    ORDERS: 'feast_orders_v2'
};

// 商家配置 - 可修改
const APP_CONFIG = {
    chefName: '何朝斌',
    phone: '13892704188',
    brandName: '斌选',
    slogan: '好菜，斌选',
    defaultAddress: ''
};

// 宴席规则：十凉八热（凉菜≥10，热菜≥8，可多不能少）
const FEAST_RULES = {
    MIN_COLD: 10,   // 凉菜最少10道
    MIN_HOT: 8,     // 热菜最少8道
    MIN_SOUP: 1     // 汤品最少1道
};

// 图片生成函数 - 获取菜品图片URL（优先用自定义，否则用默认占位图）
function getDishImageUrl(name, index, customUrl) {
    if (customUrl) return customUrl;
    const imgIds = [292, 225, 365, 835, 488, 593, 678, 410, 521, 634, 747, 858, 123, 234, 345, 456, 567, 678, 789, 890, 135, 246, 357, 468, 579, 680, 791, 802, 913, 124, 235, 346, 457, 568, 679, 780];
    const imgId = imgIds[index % imgIds.length];
    return `https://picsum.photos/id/${imgId}/400/300`;
}

// 初始Mock数据 - 36道菜品
const INITIAL_DATA = {
    dishes: [
        // ===== 热菜 16道 =====
        { id: 'dish_001', name: '红烧狮子头', price: 88, category: '热菜', description: '精选五花肉，手工制作，肉质鲜嫩，入口即化', isAvailable: true, imageUrl: getDishImageUrl('红烧狮子头', 0), ingredients: [
            { name: '猪五花肉', category: '肉类', amount: 1.5, unit: '斤' },
            { name: '荸荠', category: '蔬菜', amount: 0.5, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.2, unit: '斤' },
            { name: '料酒', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_002', name: '清蒸鲈鱼', price: 128, category: '热菜', description: '新鲜鲈鱼，清蒸保持原味，肉质细嫩', isAvailable: true, imageUrl: getDishImageUrl('清蒸鲈鱼', 1), ingredients: [
            { name: '鲈鱼', category: '海鲜', amount: 1.5, unit: '斤' },
            { name: '葱', category: '蔬菜', amount: 0.2, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '料酒', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_003', name: '糖醋排骨', price: 78, category: '热菜', description: '酸甜可口，外酥里嫩，老少皆宜', isAvailable: true, imageUrl: getDishImageUrl('糖醋排骨', 2), ingredients: [
            { name: '猪小排', category: '肉类', amount: 2, unit: '斤' },
            { name: '白糖', category: '调料', amount: 0.2, unit: '斤' },
            { name: '香醋', category: '调料', amount: 0.2, unit: '斤' },
            { name: '番茄酱', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_004', name: '宫保鸡丁', price: 58, category: '热菜', description: '花生鸡丁，香辣下饭，经典川菜', isAvailable: true, imageUrl: getDishImageUrl('宫保鸡丁', 3), ingredients: [
            { name: '鸡胸肉', category: '肉类', amount: 1, unit: '斤' },
            { name: '花生米', category: '其他', amount: 0.3, unit: '斤' },
            { name: '干辣椒', category: '调料', amount: 0.1, unit: '斤' },
            { name: '黄瓜', category: '蔬菜', amount: 0.3, unit: '斤' }
        ] },
        { id: 'dish_005', name: '水煮牛肉', price: 98, category: '热菜', description: '麻辣鲜香，牛肉嫩滑，川味十足', isAvailable: true, imageUrl: getDishImageUrl('水煮牛肉', 4), ingredients: [
            { name: '牛里脊', category: '肉类', amount: 1.5, unit: '斤' },
            { name: '豆芽', category: '蔬菜', amount: 0.5, unit: '斤' },
            { name: '干辣椒', category: '调料', amount: 0.2, unit: '斤' },
            { name: '花椒', category: '调料', amount: 0.05, unit: '斤' },
            { name: '豆瓣酱', category: '调料', amount: 0.2, unit: '斤' }
        ] },
        { id: 'dish_006', name: '东坡肘子', price: 128, category: '热菜', description: '软糯入味，肥而不腻，传统名菜', isAvailable: true, imageUrl: getDishImageUrl('东坡肘子', 5), ingredients: [
            { name: '猪肘子', category: '肉类', amount: 3, unit: '斤' },
            { name: '冰糖', category: '调料', amount: 0.2, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.3, unit: '斤' },
            { name: '料酒', category: '调料', amount: 0.2, unit: '斤' },
            { name: '八角', category: '调料', amount: 0.02, unit: '斤' }
        ] },
        { id: 'dish_007', name: '剁椒鱼头', price: 88, category: '热菜', description: '鲜辣开胃，鱼头肥美，湘菜代表', isAvailable: true, imageUrl: getDishImageUrl('剁椒鱼头', 6), ingredients: [
            { name: '鱼头', category: '海鲜', amount: 2.5, unit: '斤' },
            { name: '剁椒', category: '调料', amount: 0.3, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '蒜', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_008', name: '蒜蓉粉丝蒸虾', price: 108, category: '热菜', description: '蒜香浓郁，虾肉Q弹，鲜美可口', isAvailable: true, imageUrl: getDishImageUrl('蒜蓉粉丝蒸虾', 7), ingredients: [
            { name: '大虾', category: '海鲜', amount: 1, unit: '斤' },
            { name: '粉丝', category: '其他', amount: 0.3, unit: '斤' },
            { name: '蒜', category: '调料', amount: 0.3, unit: '斤' },
            { name: '小葱', category: '蔬菜', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_009', name: '黑椒牛柳', price: 98, category: '热菜', description: '黑椒酱香，牛肉滑嫩，西式风味', isAvailable: true, imageUrl: getDishImageUrl('黑椒牛柳', 8), ingredients: [
            { name: '牛里脊', category: '肉类', amount: 1.5, unit: '斤' },
            { name: '青椒', category: '蔬菜', amount: 0.5, unit: '斤' },
            { name: '洋葱', category: '蔬菜', amount: 0.3, unit: '斤' },
            { name: '黑胡椒', category: '调料', amount: 0.05, unit: '斤' }
        ] },
        { id: 'dish_010', name: '铁板牛仔骨', price: 138, category: '热菜', description: '铁板滋滋作响，骨肉相连，香气四溢', isAvailable: true, imageUrl: getDishImageUrl('铁板牛仔骨', 9), ingredients: [
            { name: '牛仔骨', category: '肉类', amount: 2, unit: '斤' },
            { name: '洋葱', category: '蔬菜', amount: 0.5, unit: '斤' },
            { name: '黑胡椒', category: '调料', amount: 0.05, unit: '斤' },
            { name: '黄油', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_011', name: '松鼠桂鱼', price: 148, category: '热菜', description: '造型精美，酸甜酥脆，苏菜经典', isAvailable: true, imageUrl: getDishImageUrl('松鼠桂鱼', 10), ingredients: [
            { name: '桂鱼', category: '海鲜', amount: 1.5, unit: '斤' },
            { name: '番茄酱', category: '调料', amount: 0.3, unit: '斤' },
            { name: '白糖', category: '调料', amount: 0.2, unit: '斤' },
            { name: '淀粉', category: '调料', amount: 0.3, unit: '斤' }
        ] },
        { id: 'dish_012', name: '香辣蟹', price: 168, category: '热菜', description: '蟹肉鲜嫩，香辣过瘾，海鲜佳品', isAvailable: true, imageUrl: getDishImageUrl('香辣蟹', 11), ingredients: [
            { name: '螃蟹', category: '海鲜', amount: 2, unit: '斤' },
            { name: '干辣椒', category: '调料', amount: 0.2, unit: '斤' },
            { name: '花椒', category: '调料', amount: 0.05, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '蒜', category: '调料', amount: 0.2, unit: '斤' }
        ] },
        { id: 'dish_013', name: '干锅花菜', price: 48, category: '热菜', description: '花菜焦香，干锅入味，下饭神器', isAvailable: true, imageUrl: getDishImageUrl('干锅花菜', 12), ingredients: [
            { name: '花菜', category: '蔬菜', amount: 1.5, unit: '斤' },
            { name: '五花肉', category: '肉类', amount: 0.3, unit: '斤' },
            { name: '干辣椒', category: '调料', amount: 0.1, unit: '斤' },
            { name: '蒜', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_014', name: '梅菜扣肉', price: 88, category: '热菜', description: '梅菜香浓，五花肉软烂，肥而不腻', isAvailable: true, imageUrl: getDishImageUrl('梅菜扣肉', 13), ingredients: [
            { name: '五花肉', category: '肉类', amount: 2, unit: '斤' },
            { name: '梅菜干', category: '其他', amount: 0.5, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.2, unit: '斤' },
            { name: '冰糖', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_015', name: '油焖大虾', price: 158, category: '热菜', description: '色泽红亮，虾肉饱满，鲜甜入味', isAvailable: true, imageUrl: getDishImageUrl('油焖大虾', 14), ingredients: [
            { name: '大虾', category: '海鲜', amount: 1.5, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '葱', category: '蔬菜', amount: 0.1, unit: '斤' },
            { name: '番茄酱', category: '调料', amount: 0.2, unit: '斤' },
            { name: '白糖', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_016', name: '葱烧海参', price: 198, category: '热菜', description: '葱香浓郁，海参软糯，鲁菜名品', isAvailable: true, imageUrl: getDishImageUrl('葱烧海参', 15), ingredients: [
            { name: '海参', category: '海鲜', amount: 1, unit: '斤' },
            { name: '大葱', category: '蔬菜', amount: 0.5, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.2, unit: '斤' },
            { name: '料酒', category: '调料', amount: 0.1, unit: '斤' }
        ] },

        // ===== 凉菜 15道 =====
        { id: 'dish_017', name: '凉拌黄瓜', price: 28, category: '凉菜', description: '爽脆可口，开胃解腻，清爽小菜', isAvailable: true, imageUrl: getDishImageUrl('凉拌黄瓜', 16), ingredients: [
            { name: '黄瓜', category: '蔬菜', amount: 1, unit: '斤' },
            { name: '蒜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '辣椒油', category: '调料', amount: 0.1, unit: '斤' },
            { name: '香醋', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_018', name: '白切鸡', price: 68, category: '凉菜', description: '选用优质土鸡，皮爽肉滑，原汁原味', isAvailable: true, imageUrl: getDishImageUrl('白切鸡', 17), ingredients: [
            { name: '三黄鸡', category: '肉类', amount: 2.5, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '葱', category: '蔬菜', amount: 0.1, unit: '斤' },
            { name: '香油', category: '调料', amount: 0.05, unit: '斤' }
        ] },
        { id: 'dish_019', name: '口水鸡', price: 58, category: '凉菜', description: '麻辣鲜香，鸡肉嫩滑，川味凉菜', isAvailable: true, imageUrl: getDishImageUrl('口水鸡', 18), ingredients: [
            { name: '三黄鸡', category: '肉类', amount: 2, unit: '斤' },
            { name: '花生米', category: '其他', amount: 0.2, unit: '斤' },
            { name: '辣椒油', category: '调料', amount: 0.2, unit: '斤' },
            { name: '花椒', category: '调料', amount: 0.05, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.2, unit: '斤' }
        ] },
        { id: 'dish_020', name: '蒜泥白肉', price: 48, category: '凉菜', description: '蒜香浓郁，肉片薄透，肥瘦相间', isAvailable: true, imageUrl: getDishImageUrl('蒜泥白肉', 19), ingredients: [
            { name: '五花肉', category: '肉类', amount: 1.5, unit: '斤' },
            { name: '蒜', category: '调料', amount: 0.2, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.2, unit: '斤' },
            { name: '香油', category: '调料', amount: 0.05, unit: '斤' }
        ] },
        { id: 'dish_021', name: '凉拌木耳', price: 32, category: '凉菜', description: '木耳爽脆，酸辣开胃，健康小菜', isAvailable: true, imageUrl: getDishImageUrl('凉拌木耳', 20), ingredients: [
            { name: '黑木耳', category: '其他', amount: 0.3, unit: '斤' },
            { name: '青椒', category: '蔬菜', amount: 0.2, unit: '斤' },
            { name: '辣椒油', category: '调料', amount: 0.1, unit: '斤' },
            { name: '香醋', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_022', name: '皮蛋豆腐', price: 32, category: '凉菜', description: '皮蛋绵密，豆腐嫩滑，经典搭配', isAvailable: true, imageUrl: getDishImageUrl('皮蛋豆腐', 21), ingredients: [
            { name: '皮蛋', category: '其他', amount: 0.5, unit: '斤' },
            { name: '豆腐', category: '其他', amount: 1, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.1, unit: '斤' },
            { name: '香油', category: '调料', amount: 0.05, unit: '斤' }
        ] },
        { id: 'dish_023', name: '盐水鸭', price: 68, category: '凉菜', description: '鸭肉紧实，咸香适中，南京名菜', isAvailable: true, imageUrl: getDishImageUrl('盐水鸭', 22), ingredients: [
            { name: '鸭子', category: '肉类', amount: 3, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' },
            { name: '花椒', category: '调料', amount: 0.05, unit: '斤' },
            { name: '盐', category: '调料', amount: 0.2, unit: '斤' }
        ] },
        { id: 'dish_024', name: '夫妻肺片', price: 58, category: '凉菜', description: '麻辣鲜香，牛肉薄切，红油飘香', isAvailable: true, imageUrl: getDishImageUrl('夫妻肺片', 23), ingredients: [
            { name: '牛肉', category: '肉类', amount: 1, unit: '斤' },
            { name: '牛杂', category: '肉类', amount: 0.5, unit: '斤' },
            { name: '辣椒油', category: '调料', amount: 0.2, unit: '斤' },
            { name: '花椒', category: '调料', amount: 0.05, unit: '斤' },
            { name: '花生米', category: '其他', amount: 0.2, unit: '斤' }
        ] },
        { id: 'dish_025', name: '凉拌海蜇', price: 48, category: '凉菜', description: '海蜇脆爽，酸辣适口，清爽解腻', isAvailable: true, imageUrl: getDishImageUrl('凉拌海蜇', 24), ingredients: [
            { name: '海蜇', category: '海鲜', amount: 0.8, unit: '斤' },
            { name: '黄瓜', category: '蔬菜', amount: 0.3, unit: '斤' },
            { name: '香醋', category: '调料', amount: 0.1, unit: '斤' },
            { name: '香油', category: '调料', amount: 0.05, unit: '斤' }
        ] },
        { id: 'dish_026', name: '酱牛肉', price: 78, category: '凉菜', description: '酱香浓郁，牛肉紧实，切片整齐', isAvailable: true, imageUrl: getDishImageUrl('酱牛肉', 25), ingredients: [
            { name: '牛腱子', category: '肉类', amount: 2, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.3, unit: '斤' },
            { name: '八角', category: '调料', amount: 0.02, unit: '斤' },
            { name: '桂皮', category: '调料', amount: 0.02, unit: '斤' },
            { name: '冰糖', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_027', name: '凉拌三丝', price: 28, category: '凉菜', description: '三色搭配，清爽爽口，营养均衡', isAvailable: true, imageUrl: getDishImageUrl('凉拌三丝', 26), ingredients: [
            { name: '海带丝', category: '海鲜', amount: 0.3, unit: '斤' },
            { name: '胡萝卜', category: '蔬菜', amount: 0.3, unit: '斤' },
            { name: '豆腐皮', category: '其他', amount: 0.3, unit: '斤' },
            { name: '香油', category: '调料', amount: 0.05, unit: '斤' }
        ] },
        { id: 'dish_028', name: '桂花糯米藕', price: 38, category: '凉菜', description: '糯米软糯，桂花香甜，甜而不腻', isAvailable: true, imageUrl: getDishImageUrl('桂花糯米藕', 27), ingredients: [
            { name: '莲藕', category: '蔬菜', amount: 1.5, unit: '斤' },
            { name: '糯米', category: '其他', amount: 0.5, unit: '斤' },
            { name: '桂花', category: '调料', amount: 0.05, unit: '斤' },
            { name: '冰糖', category: '调料', amount: 0.2, unit: '斤' }
        ] },
        { id: 'dish_029', name: '凉拌腐竹', price: 32, category: '凉菜', description: '腐竹劲道，调料入味，素食佳品', isAvailable: true, imageUrl: getDishImageUrl('凉拌腐竹', 28), ingredients: [
            { name: '腐竹', category: '其他', amount: 0.4, unit: '斤' },
            { name: '黄瓜', category: '蔬菜', amount: 0.3, unit: '斤' },
            { name: '辣椒油', category: '调料', amount: 0.1, unit: '斤' },
            { name: '酱油', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_030', name: '樟茶鸭', price: 88, category: '凉菜', description: '樟木熏香，鸭肉紧实，川菜名品', isAvailable: true, imageUrl: getDishImageUrl('樟茶鸭', 29), ingredients: [
            { name: '鸭子', category: '肉类', amount: 3, unit: '斤' },
            { name: '茶叶', category: '调料', amount: 0.05, unit: '斤' },
            { name: '樟木屑', category: '其他', amount: 0.5, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_031', name: '凉拌菠菜粉丝', price: 28, category: '凉菜', description: '菠菜鲜嫩，粉丝爽滑，清淡健康', isAvailable: true, imageUrl: getDishImageUrl('凉拌菠菜粉丝', 30), ingredients: [
            { name: '菠菜', category: '蔬菜', amount: 1, unit: '斤' },
            { name: '粉丝', category: '其他', amount: 0.2, unit: '斤' },
            { name: '香油', category: '调料', amount: 0.05, unit: '斤' },
            { name: '香醋', category: '调料', amount: 0.1, unit: '斤' }
        ] },

        // ===== 汤品 5道 =====
        { id: 'dish_032', name: '佛跳墙', price: 388, category: '汤品', description: '传统名菜，汇集多种珍贵食材，汤鲜味美', isAvailable: true, imageUrl: getDishImageUrl('佛跳墙', 31), ingredients: [
            { name: '海参', category: '海鲜', amount: 0.5, unit: '斤' },
            { name: '鲍鱼', category: '海鲜', amount: 0.5, unit: '斤' },
            { name: '花胶', category: '海鲜', amount: 0.3, unit: '斤' },
            { name: '老母鸡', category: '肉类', amount: 1, unit: '斤' },
            { name: '料酒', category: '调料', amount: 0.2, unit: '斤' }
        ] },
        { id: 'dish_033', name: '酸辣汤', price: 38, category: '汤品', description: '酸辣开胃，用料丰富，暖胃佳品', isAvailable: true, imageUrl: getDishImageUrl('酸辣汤', 32), ingredients: [
            { name: '豆腐', category: '其他', amount: 0.5, unit: '斤' },
            { name: '木耳', category: '其他', amount: 0.1, unit: '斤' },
            { name: '鸡蛋', category: '其他', amount: 0.3, unit: '斤' },
            { name: '香醋', category: '调料', amount: 0.2, unit: '斤' },
            { name: '胡椒粉', category: '调料', amount: 0.02, unit: '斤' }
        ] },
        { id: 'dish_034', name: '老火靓汤', price: 68, category: '汤品', description: '慢火熬制，汤色清澈，滋补养生', isAvailable: true, imageUrl: getDishImageUrl('老火靓汤', 33), ingredients: [
            { name: '猪排骨', category: '肉类', amount: 1.5, unit: '斤' },
            { name: '玉米', category: '蔬菜', amount: 1, unit: '斤' },
            { name: '胡萝卜', category: '蔬菜', amount: 0.5, unit: '斤' },
            { name: '生姜', category: '调料', amount: 0.1, unit: '斤' }
        ] },
        { id: 'dish_035', name: '番茄蛋花汤', price: 28, category: '汤品', description: '酸甜可口，蛋花飘浮，家常美味', isAvailable: true, imageUrl: getDishImageUrl('番茄蛋花汤', 34), ingredients: [
            { name: '番茄', category: '蔬菜', amount: 0.5, unit: '斤' },
            { name: '鸡蛋', category: '其他', amount: 0.3, unit: '斤' },
            { name: '葱', category: '蔬菜', amount: 0.05, unit: '斤' },
            { name: '香油', category: '调料', amount: 0.02, unit: '斤' }
        ] },
        { id: 'dish_036', name: '银耳莲子羹', price: 38, category: '汤品', description: '银耳软糯，莲子清香，润肺养颜', isAvailable: true, imageUrl: getDishImageUrl('银耳莲子羹', 35), ingredients: [
            { name: '银耳', category: '其他', amount: 0.1, unit: '斤' },
            { name: '莲子', category: '其他', amount: 0.2, unit: '斤' },
            { name: '冰糖', category: '调料', amount: 0.2, unit: '斤' },
            { name: '红枣', category: '其他', amount: 0.1, unit: '斤' }
        ] }
    ],

    packages: [
        { id: 'pkg_001', name: '喜庆宴套餐', originalPrice: 3888, currentPrice: 3288, description: '标准宴席套餐，十凉八热三汤，适合婚宴、寿宴', includedDishes: ['dish_001','dish_002','dish_003','dish_004','dish_005','dish_006','dish_007','dish_008','dish_017','dish_018','dish_019','dish_020','dish_021','dish_022','dish_023','dish_024','dish_025','dish_026','dish_032','dish_033','dish_034'], suitableFor: 10, isAvailable: true },
        { id: 'pkg_002', name: '商务宴请套餐', originalPrice: 5888, currentPrice: 4888, description: '高端商务套餐，十二凉十热四汤，适合商务宴请', includedDishes: ['dish_001','dish_002','dish_003','dish_004','dish_005','dish_006','dish_007','dish_008','dish_009','dish_010','dish_017','dish_018','dish_019','dish_020','dish_021','dish_022','dish_023','dish_024','dish_025','dish_026','dish_027','dish_032','dish_033','dish_034','dish_035'], suitableFor: 12, isAvailable: true },
        { id: 'pkg_003', name: '精品小聚套餐', originalPrice: 2888, currentPrice: 2288, description: '小型宴席套餐，十凉八热两汤，适合家庭聚会', includedDishes: ['dish_001','dish_002','dish_003','dish_004','dish_005','dish_006','dish_007','dish_008','dish_017','dish_018','dish_019','dish_020','dish_021','dish_022','dish_023','dish_024','dish_025','dish_026','dish_032','dish_033'], suitableFor: 8, isAvailable: true }
    ],

    orders: [
        { id: 'ord_001', customerName: '张先生', phone: '13800138001', date: new Date(Date.now() + 3*86400000).toISOString(), guestCount: 10, packageId: 'pkg_001', totalPrice: 3288, status: 'confirmed', createdAt: new Date(Date.now() - 2*86400000).toISOString(), notes: '需要准备生日蛋糕', selectedDishes: ['dish_001','dish_002','dish_003','dish_004','dish_005','dish_006','dish_007','dish_008','dish_017','dish_018','dish_019','dish_020','dish_021','dish_022','dish_023','dish_024','dish_025','dish_026','dish_032','dish_033','dish_034'] },
        { id: 'ord_002', customerName: '李女士', phone: '13900139002', date: new Date(Date.now() + 5*86400000).toISOString(), guestCount: 12, packageId: 'pkg_002', totalPrice: 4888, status: 'pending', createdAt: new Date(Date.now() - 86400000).toISOString(), notes: '有素食客人，需要准备素菜', selectedDishes: ['dish_001','dish_002','dish_003','dish_004','dish_005','dish_006','dish_007','dish_008','dish_009','dish_010','dish_017','dish_018','dish_019','dish_020','dish_021','dish_022','dish_023','dish_024','dish_025','dish_026','dish_027','dish_032','dish_033','dish_034','dish_035'] },
        { id: 'ord_003', customerName: '王经理', phone: '13700137003', date: new Date(Date.now() + 7*86400000).toISOString(), guestCount: 8, packageId: 'pkg_003', totalPrice: 2288, status: 'pending', createdAt: new Date().toISOString(), notes: '需要包间，安静一点的位置', selectedDishes: ['dish_001','dish_002','dish_003','dish_004','dish_005','dish_006','dish_007','dish_008','dish_017','dish_018','dish_019','dish_020','dish_021','dish_022','dish_023','dish_024','dish_025','dish_026','dish_032','dish_033'] }
    ]
};

class DataManager {
    constructor() {
        this.data = { dishes: [], packages: [], orders: [] };
        this.initialized = false;
    }

    async init() {
        await NativeStorage.init();

        // 尝试从新版存储读取
        let sd = await NativeStorage.get(STORAGE_KEYS.DISHES);
        let sp = await NativeStorage.get(STORAGE_KEYS.PACKAGES);
        let so = await NativeStorage.get(STORAGE_KEYS.ORDERS);

        // 如果没有数据，尝试从旧版 LocalStorage 迁移
        if (!sd && !sp && !so) {
            const migrated = await this.migrateFromOldStorage();
            if (migrated) {
                sd = await NativeStorage.get(STORAGE_KEYS.DISHES);
                sp = await NativeStorage.get(STORAGE_KEYS.PACKAGES);
                so = await NativeStorage.get(STORAGE_KEYS.ORDERS);
            }
        }

        try {
            this.data.dishes = sd ? JSON.parse(sd) : JSON.parse(JSON.stringify(INITIAL_DATA.dishes));
        } catch(e) {
            console.error('解析菜品数据失败:', e);
            this.data.dishes = JSON.parse(JSON.stringify(INITIAL_DATA.dishes));
        }
        try {
            this.data.packages = sp ? JSON.parse(sp) : JSON.parse(JSON.stringify(INITIAL_DATA.packages));
        } catch(e) {
            console.error('解析套餐数据失败:', e);
            this.data.packages = JSON.parse(JSON.stringify(INITIAL_DATA.packages));
        }
        try {
            this.data.orders = so ? JSON.parse(so) : JSON.parse(JSON.stringify(INITIAL_DATA.orders));
        } catch(e) {
            console.error('解析订单数据失败:', e);
            this.data.orders = JSON.parse(JSON.stringify(INITIAL_DATA.orders));
        }
        await this.saveToStorage();
        this.initialized = true;
    }

    // 从旧版 LocalStorage 迁移数据
    async migrateFromOldStorage() {
        const oldKeys = {
            dishes: ['feast_dishes_v2', 'feast_dishes_v1', 'feast_dishes'],
            packages: ['feast_packages_v2', 'feast_packages_v1', 'feast_packages'],
            orders: ['feast_orders_v2', 'feast_orders_v1', 'feast_orders']
        };

        let hasMigrated = false;

        for (const key of oldKeys.dishes) {
            const data = localStorage.getItem(key);
            if (data) {
                await NativeStorage.set(STORAGE_KEYS.DISHES, data);
                hasMigrated = true;
                break;
            }
        }

        for (const key of oldKeys.packages) {
            const data = localStorage.getItem(key);
            if (data) {
                await NativeStorage.set(STORAGE_KEYS.PACKAGES, data);
                hasMigrated = true;
                break;
            }
        }

        for (const key of oldKeys.orders) {
            const data = localStorage.getItem(key);
            if (data) {
                await NativeStorage.set(STORAGE_KEYS.ORDERS, data);
                hasMigrated = true;
                break;
            }
        }

        if (hasMigrated) {
            console.log('数据已从旧版 LocalStorage 迁移到 Native 存储');
        }

        return hasMigrated;
    }

    async saveToStorage() {
        await NativeStorage.set(STORAGE_KEYS.DISHES, JSON.stringify(this.data.dishes));
        await NativeStorage.set(STORAGE_KEYS.PACKAGES, JSON.stringify(this.data.packages));
        await NativeStorage.set(STORAGE_KEYS.ORDERS, JSON.stringify(this.data.orders));
    }

    async resetToDefault() {
        this.data.dishes = JSON.parse(JSON.stringify(INITIAL_DATA.dishes));
        this.data.packages = JSON.parse(JSON.stringify(INITIAL_DATA.packages));
        this.data.orders = JSON.parse(JSON.stringify(INITIAL_DATA.orders));
        await this.saveToStorage();
    }

    getDishes() { return this.data.dishes; }
    getDishesByCategory(cat) { return this.data.dishes.filter(d => d.category === cat); }
    getDishById(id) { return this.data.dishes.find(d => d.id === id); }
    async addDish(dish) { this.data.dishes.push(dish); await this.saveToStorage(); }
    async updateDish(id, updates) {
        const i = this.data.dishes.findIndex(d => d.id === id);
        if (i !== -1) { this.data.dishes[i] = { ...this.data.dishes[i], ...updates }; await this.saveToStorage(); }
    }
    async deleteDish(id) { this.data.dishes = this.data.dishes.filter(d => d.id !== id); await this.saveToStorage(); }

    getPackages() { return this.data.packages; }
    getPackageById(id) { return this.data.packages.find(p => p.id === id); }
    async addPackage(pkg) { this.data.packages.push(pkg); await this.saveToStorage(); }
    async updatePackage(id, updates) {
        const i = this.data.packages.findIndex(p => p.id === id);
        if (i !== -1) { this.data.packages[i] = { ...this.data.packages[i], ...updates }; await this.saveToStorage(); }
    }
    async deletePackage(id) { this.data.packages = this.data.packages.filter(p => p.id !== id); await this.saveToStorage(); }

    getOrders() { return this.data.orders; }
    getOrderById(id) { return this.data.orders.find(o => o.id === id); }
    async addOrder(order) { this.data.orders.push(order); await this.saveToStorage(); }
    async updateOrder(id, updates) {
        const i = this.data.orders.findIndex(o => o.id === id);
        if (i !== -1) { this.data.orders[i] = { ...this.data.orders[i], ...updates }; await this.saveToStorage(); }
    }
    async deleteOrder(id) { this.data.orders = this.data.orders.filter(o => o.id !== id); await this.saveToStorage(); }

    getTodayOrderCount() { return this.data.orders.filter(o => new Date(o.date).toDateString() === new Date().toDateString()).length; }
    getPendingOrderCount() { return this.data.orders.filter(o => o.status === 'pending').length; }
    getConfirmedOrderCount() { return this.data.orders.filter(o => o.status === 'confirmed').length; }
    getOrdersByDate(date) { const t = new Date(date).toDateString(); return this.data.orders.filter(o => new Date(o.date).toDateString() === t); }
    getOrdersByMonth(y, m) { return this.data.orders.filter(o => { const d = new Date(o.date); return d.getFullYear() === y && d.getMonth() === m; }); }

    // 计算选菜总价
    calcTotalPrice(dishIds) {
        return dishIds.reduce((sum, id) => {
            const d = this.getDishById(id);
            return sum + (d ? d.price : 0);
        }, 0);
    }

    // 校验十凉八热规则
    validateFeastRules(dishIds) {
        const cold = dishIds.filter(id => { const d = this.getDishById(id); return d && d.category === '凉菜'; }).length;
        const hot = dishIds.filter(id => { const d = this.getDishById(id); return d && d.category === '热菜'; }).length;
        const soup = dishIds.filter(id => { const d = this.getDishById(id); return d && d.category === '汤品'; }).length;
        return {
            valid: cold >= FEAST_RULES.MIN_COLD && hot >= FEAST_RULES.MIN_HOT && soup >= FEAST_RULES.MIN_SOUP,
            cold, hot, soup,
            errors: [
                ...(cold < FEAST_RULES.MIN_COLD ? [`凉菜还需选择${FEAST_RULES.MIN_COLD - cold}道（当前${cold}/${FEAST_RULES.MIN_COLD}）`] : []),
                ...(hot < FEAST_RULES.MIN_HOT ? [`热菜还需选择${FEAST_RULES.MIN_HOT - hot}道（当前${hot}/${FEAST_RULES.MIN_HOT}）`] : []),
                ...(soup < FEAST_RULES.MIN_SOUP ? [`汤品还需选择${FEAST_RULES.MIN_SOUP - soup}道（当前${soup}/${FEAST_RULES.MIN_SOUP}）`] : [])
            ]
        };
    }
}

const dataManager = new DataManager();

// 异步初始化（Capacitor 环境需要）
(async () => {
    await dataManager.init();
    // 触发应用初始化完成事件
    window.dispatchEvent(new CustomEvent('dataManagerReady'));
})();
