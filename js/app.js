/**
 * 斌选 - 主应用逻辑 (完整功能版)
 * 单页应用(SPA)实现
 * - 统一自定义弹窗系统（无原生confirm/alert）
 * - 定制选菜流程（十凉八热规则校验）
 */

// 应用状态
const appState = {
    currentPage: 'dashboard',
    selectedPackage: null,
    selectedDate: new Date(),
    currentMonth: new Date(),
    searchKeyword: '',
    editingDish: null,
    editingPackage: null,
    // 选菜定制状态
    selectedDishes: [],   // 当前已选菜品ID数组
    customizeStep: 1,     // 定制步骤: 1=选凉菜, 2=选热菜, 3=选汤品, 4=确认套餐, 5=填信息
    mainTables: 1,        // 主席数
    backupTables: 0       // 备席数
};

// ==================== 工具函数 ====================
const utils = {
    formatPrice(price) {
        return '¥' + (Number(price) || 0).toFixed(0);
    },
    formatDate(date) {
        const d = new Date(date);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    },
    formatDateShort(date) {
        const d = new Date(date);
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    },
    formatDateInput(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    generateId(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    },
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.background = type === 'error' ? 'var(--error)' : type === 'warning' ? 'var(--warning)' : 'var(--text-primary)';
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// ==================== 图片上传处理 ====================

/**
 * 绑定图片上传按钮事件（支持相机直拍 + 相册选择 + 文件选择）
 */
function setupDishImageUpload(mode) {
    const uploadBtn = document.getElementById(mode + 'DishUploadBtn');
    const fileInput = document.getElementById(mode + 'DishFileInput');
    const uploadArea = document.getElementById(mode + 'DishImageUpload');
    
    console.log('setupDishImageUpload:', mode, { uploadBtn: !!uploadBtn, fileInput: !!fileInput, uploadArea: !!uploadArea, NativeCamera: !!window.NativeCamera });
    
    if (!uploadBtn || !fileInput) {
        console.warn('上传组件未找到:', mode);
        return;
    }
    
    // 点击上传按钮 - 使用 onclick 确保覆盖
    uploadBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('上传按钮点击:', mode, 'NativeCamera:', !!window.NativeCamera);
        
        if (window.NativeCamera) {
            showImageSourcePicker(mode);
        } else {
            fileInput.click();
        }
        return false;
    };
    
    // 文件选择器变化事件
    fileInput.onchange = (e) => {
        console.log('文件选择器变化:', mode, e.target.files);
        handleDishImageUpload(e.target.files[0], mode);
    };
}

/**
 * 原生环境：弹出图片来源选择（拍照/相册）
 */
async function showImageSourcePicker(mode) {
    console.log('showImageSourcePicker 被调用:', mode);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'imageSourcePickerModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:320px;">
            <h3 style="text-align:center;margin-bottom:20px;">选择图片来源</h3>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <button class="btn btn-primary btn-block" id="pickCamera">
                    <span class="material-icons">photo_camera</span>
                    拍照
                </button>
                <button class="btn btn-secondary btn-block" id="pickGallery">
                    <span class="material-icons">photo_library</span>
                    从相册选择
                </button>
                <button class="btn btn-secondary btn-block" id="pickCancel" style="margin-top:4px;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    console.log('图片来源选择弹窗已创建');

    document.getElementById('pickCamera').onclick = async () => {
        console.log('点击拍照按钮');
        modal.remove();
        try {
            const base64 = await window.NativeCamera.takePhoto();
            console.log('拍照结果:', base64 ? '成功' : '失败');
            if (base64) processNativeImage(base64, mode);
        } catch(e) {
            console.error('拍照异常:', e);
            utils.showToast('拍照失败: ' + e.message, 'error');
        }
    };
    document.getElementById('pickGallery').onclick = async () => {
        console.log('点击相册按钮');
        modal.remove();
        try {
            const base64 = await window.NativeCamera.pickFromGallery();
            console.log('相册结果:', base64 ? '成功' : '失败');
            if (base64) processNativeImage(base64, mode);
        } catch(e) {
            console.error('相册异常:', e);
            utils.showToast('选择相册失败: ' + e.message, 'error');
        }
    };
    document.getElementById('pickCancel').onclick = () => {
        console.log('点击取消按钮');
        modal.remove();
    };
}

/**
 * 处理原生相机/相册返回的图片（已压缩，直接存储）
 */
async function processNativeImage(base64, mode) {
    const previewEl = document.getElementById(mode + 'DishImgPreview');
    const uploadBtn = document.getElementById(mode + 'DishUploadBtn');

    // 显示预览
    if (previewEl) { previewEl.src = base64; previewEl.style.display = 'block'; }
    if (uploadBtn) { uploadBtn.innerHTML = '<span class="material-icons">refresh</span><span>重新上传</span>'; }

    // 存入 IndexedDB
    try {
        await ImageDB.save(mode + '_temp', base64);
    } catch(e) {
        console.warn('IndexedDB存储失败', e);
    }
}

/**
 * 处理图片上传：压缩 + 预览 + IndexedDB存储
 */
function handleDishImageUpload(file, mode) {
    if (!file || !file.type.startsWith('image/')) return;

    const previewEl = document.getElementById(mode + 'DishImgPreview');
    const uploadBtn = document.getElementById(mode + 'DishUploadBtn');
    const uploadEl = document.getElementById(mode + 'DishImageUpload');
    if (!uploadEl) return;

    // 显示上传中状态
    if (uploadBtn) {
        uploadBtn.innerHTML = '<span class="material-icons" style="animation:spin 1s linear infinite;">sync</span><span>压缩中...</span>';
    }

    // 使用 CompressorJS 压缩图片
    new Compressor(file, {
        quality: 0.6,
        maxWidth: 800,
        maxHeight: 600,
        mimeType: 'image/jpeg',
        success(result) {
            // 转为 Base64
            const reader = new FileReader();
            reader.onload = async function(e) {
                const base64 = e.target.result;
                // 存入 IndexedDB（用临时key暂存，保存时再绑定dishId）
                try {
                    await ImageDB.save(mode + '_temp', base64);
                } catch(err) {
                    console.warn('IndexedDB存储失败，使用内存缓存', err);
                }
                // 显示预览
                if (previewEl) {
                    previewEl.src = base64;
                    previewEl.style.display = 'block';
                }
                // 更新按钮
                if (uploadBtn) {
                    uploadBtn.innerHTML = '<span class="material-icons">refresh</span><span>重新上传</span>';
                }
            };
            reader.readAsDataURL(result);
        },
        error(err) {
            if (uploadBtn) {
                uploadBtn.innerHTML = '<span class="material-icons">error_outline</span><span>上传失败，点击重试</span>';
            }
            utils.showToast('图片压缩失败', 'error');
        }
    });
}

// ==================== 图片加载工具 ====================

// 异步加载菜品图片（优先IndexedDB，其次默认图）
async function loadDishImage(imgEl, dishId, dishName, dishIndex) {
    if (dishId) {
        try {
            const customImg = await ImageDB.get(dishId);
            if (customImg) { imgEl.src = customImg; return; }
        } catch(e) {}
    }
    imgEl.src = getDishImageUrl(dishName, dishIndex, null);
}

// 页面加载后异步替换所有菜品图片
function initDishImages() {
    document.querySelectorAll('img[data-dish-id]').forEach(img => {
        const dishId = img.dataset.dishId;
        const dishName = img.dataset.dishName || '';
        const dishIndex = parseInt(img.dataset.dishIndex || '0');
        loadDishImage(img, dishId, dishName, dishIndex);
    });
}

// ==================== 统一弹窗系统 ====================

/**
 * 自定义确认弹窗（替代原生confirm）
 * @param {Object} options
 * @param {string} options.title - 标题
 * @param {string} options.message - 内容
 * @param {string} options.type - 类型: warning / danger / info
 * @param {string} options.confirmText - 确认按钮文字
 * @param {string} options.cancelText - 取消按钮文字
 * @returns {Promise<boolean>}
 */
function customConfirm({ title = '提示', message = '', type = 'warning', confirmText = '确定', cancelText = '取消' } = {}) {
    return new Promise((resolve) => {
        const iconMap = {
            warning: 'warning_amber',
            danger: 'error_outline',
            info: 'info'
        };
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-box">
                <div class="confirm-icon ${type}">
                    <span class="material-icons" style="font-size: 32px;">${iconMap[type] || 'info'}</span>
                </div>
                <div class="confirm-title">${title}</div>
                <div class="confirm-message">${message}</div>
                <div class="confirm-actions">
                    <button class="btn btn-secondary" id="confirmCancel">${cancelText}</button>
                    <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" id="confirmOk">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const cleanup = () => modal.remove();
        modal.querySelector('#confirmOk').onclick = () => { cleanup(); resolve(true); };
        modal.querySelector('#confirmCancel').onclick = () => { cleanup(); resolve(false); };
        modal.addEventListener('click', (e) => { if (e.target === modal) { cleanup(); resolve(false); } });
    });
}

/**
 * 自定义Alert弹窗（替代原生alert）
 */
function customAlert({ title = '提示', message = '', type = 'info', confirmText = '我知道了' } = {}) {
    return new Promise((resolve) => {
        const iconMap = {
            success: 'check_circle',
            warning: 'warning_amber',
            danger: 'error_outline',
            info: 'info'
        };
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-box">
                <div class="confirm-icon ${type === 'success' ? 'info' : type}" style="${type === 'success' ? 'background:rgba(16,185,129,0.1);color:var(--success);' : ''}">
                    <span class="material-icons" style="font-size: 32px;">${iconMap[type] || 'info'}</span>
                </div>
                <div class="confirm-title">${title}</div>
                <div class="confirm-message">${message}</div>
                <div class="confirm-actions">
                    <button class="btn btn-primary" id="alertOk" style="flex:1;">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const cleanup = () => modal.remove();
        modal.querySelector('#alertOk').onclick = () => { cleanup(); resolve(true); };
        modal.addEventListener('click', (e) => { if (e.target === modal) { cleanup(); resolve(true); } });
    });
}

// ==================== 页面渲染 ====================

const pages = {

    // ---------- 首页 ----------
    dashboard() {
        const todayCount = dataManager.getTodayOrderCount();
        const pendingCount = dataManager.getPendingOrderCount();
        const confirmedCount = dataManager.getConfirmedOrderCount();
        const packages = dataManager.getPackages();
        const orders = dataManager.getOrders().slice(0, 3);

        return `
            <div class="page">
                <div style="text-align:center;margin-bottom:24px;">
                    <h1 class="page-title" style="font-size:32px;margin-bottom:8px;">${APP_CONFIG.brandName}</h1>
                    <p style="font-size:16px;color:var(--primary);font-weight:500;">${APP_CONFIG.slogan}</p>
                </div>
                <p class="page-subtitle" style="text-align:center;">今天是 ${utils.formatDate(new Date())}</p>

                <div class="stats-grid">
                    <div class="stat-card" onclick="navigateTo('schedule')" style="cursor: pointer;">
                        <div class="stat-icon primary">
                            <span class="material-icons">receipt_long</span>
                        </div>
                        <div class="stat-value">${todayCount}</div>
                        <div class="stat-label">今日订单</div>
                        ${pendingCount > 0 ? `<div class="stat-subtitle">${pendingCount}个待确认</div>` : ''}
                    </div>
                    <div class="stat-card" onclick="navigateTo('schedule')" style="cursor: pointer;">
                        <div class="stat-icon warning">
                            <span class="material-icons">pending_actions</span>
                        </div>
                        <div class="stat-value">${pendingCount}</div>
                        <div class="stat-label">待确认订单</div>
                    </div>
                    <div class="stat-card" onclick="navigateTo('schedule')" style="cursor: pointer;">
                        <div class="stat-icon success">
                            <span class="material-icons">check_circle</span>
                        </div>
                        <div class="stat-value">${confirmedCount}</div>
                        <div class="stat-label">已确认订单</div>
                    </div>
                    <div class="stat-card" onclick="navigateTo('packagesManage')" style="cursor: pointer;">
                        <div class="stat-icon price">
                            <span class="material-icons">restaurant_menu</span>
                        </div>
                        <div class="stat-value">${packages.length}</div>
                        <div class="stat-label">套餐数量</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">快捷操作</h2>
                    </div>
                    <div class="quick-actions-grid">
                        <button class="btn btn-primary quick-action-btn" onclick="navigateTo('packages')">
                            <span class="material-icons">add_shopping_cart</span>
                            <span>新建订单</span>
                        </button>
                        <button class="btn btn-secondary quick-action-btn" onclick="navigateTo('dishes')">
                            <span class="material-icons">set_meal</span>
                            <span>管理菜品</span>
                        </button>
                        <button class="btn btn-secondary quick-action-btn" onclick="navigateTo('packagesManage')">
                            <span class="material-icons">restaurant_menu</span>
                            <span>管理套餐</span>
                        </button>
                        <button class="btn btn-secondary quick-action-btn" onclick="navigateTo('schedule')">
                            <span class="material-icons">calendar_today</span>
                            <span>查看排程</span>
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">近期订单</h2>
                        <button class="btn btn-sm btn-secondary" onclick="navigateTo('schedule')">查看全部</button>
                    </div>
                    ${orders.length === 0 ?
                        '<div class="empty-state"><div class="empty-state-icon"><span class="material-icons">inbox</span></div><div class="empty-state-text">暂无订单</div></div>' :
                        orders.map(order => this.renderOrderItem(order)).join('')
                    }
                </div>
            </div>
        `;
    },

    renderOrderItem(order) {
        const pkg = dataManager.getPackageById(order.packageId);
        const statusText = { pending: '待确认', confirmed: '已确认', cancelled: '已取消' }[order.status];
        const statusClass = order.status;
        return `
            <div class="order-item" onclick="showOrderDetail('${order.id}')">
                <div class="order-header">
                    <span class="order-customer">${order.customerName}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-details">
                    ${pkg ? pkg.name : '定制套餐'} · ${order.mainTables || order.tableCount || '-'}备${order.backupTables || '0'} · ${utils.formatDateShort(order.date)}
                </div>
                <div class="order-price">${utils.formatPrice(order.totalPrice)}</div>
            </div>
        `;
    },

    // ---------- 选择套餐 ----------
    packages() {
        const packages = dataManager.getPackages();
        return `
            <div class="page">
                <h1 class="page-title">选择套餐</h1>
                <p class="page-subtitle">请选择套餐，或选择定制套餐自由选菜</p>

                <button class="btn btn-secondary" style="margin-bottom: 16px; width: 100%;" onclick="showPackageCompare()">
                    <span class="material-icons" style="font-size: 18px;">compare</span>
                    对比所有套餐
                </button>

                ${packages.map(pkg => {
                    const dishCount = pkg.includedDishes ? pkg.includedDishes.length : 0;
                    const coldCount = pkg.includedDishes ? pkg.includedDishes.filter(id => { const d = dataManager.getDishById(id); return d && d.category === '凉菜'; }).length : 0;
                    const hotCount = pkg.includedDishes ? pkg.includedDishes.filter(id => { const d = dataManager.getDishById(id); return d && d.category === '热菜'; }).length : 0;
                    const soupCount = pkg.includedDishes ? pkg.includedDishes.filter(id => { const d = dataManager.getDishById(id); return d && d.category === '汤品'; }).length : 0;
                    return `
                        <div class="package-card">
                            <div class="package-content">
                                <h3 class="package-title">${pkg.name}</h3>
                                <p class="package-description">${pkg.description}</p>
                                <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                                    <span class="dish-category">凉菜${coldCount}道</span>
                                    <span class="dish-category">热菜${hotCount}道</span>
                                    <span class="dish-category">汤品${soupCount}道</span>
                                    <span class="dish-category">共${dishCount}道</span>
                                </div>
                                <div class="package-footer">
                                    <div>
                                        <span class="package-price">${utils.formatPrice(pkg.currentPrice)}</span>
                                        ${pkg.originalPrice > pkg.currentPrice ?
                                            `<span class="package-original-price">${utils.formatPrice(pkg.originalPrice)}</span>` : ''}
                                        <span style="font-size:11px;color:var(--text-light);display:block;">每席</span>
                                    </div>
                                    <button class="btn btn-primary" onclick="selectPackage('${pkg.id}')">选择</button>
                                </div>
                                ${pkg.suitableFor ? `<span class="dish-category" style="margin-top:8px;">每席${pkg.suitableFor}人</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}

                <div class="card" style="text-align:center;cursor:pointer;border:2px dashed var(--primary);background:rgba(91,95,239,0.03);" onclick="startCustomize()">
                    <span class="material-icons" style="font-size:40px;color:var(--primary);margin-bottom:8px;">tune</span>
                    <h3 style="color:var(--primary);margin-bottom:4px;">定制套餐</h3>
                    <p style="font-size:13px;color:var(--text-secondary);">自由选择菜品，满足十凉八热规则</p>
                </div>
            </div>
        `;
    },

    // ---------- 定制选菜页面（分步流程）----------
    customize() {
        const allDishes = dataManager.getDishes();
        const hotDishes = allDishes.filter(d => d.category === '热菜');
        const coldDishes = allDishes.filter(d => d.category === '凉菜');
        const soupDishes = allDishes.filter(d => d.category === '汤品');

        const validation = dataManager.validateFeastRules(appState.selectedDishes);
        const totalPrice = dataManager.calcTotalPrice(appState.selectedDishes);

        const stepTitles = ['', '选择凉菜', '选择热菜', '选择汤品'];
        const stepDesc = ['', `请选择${FEAST_RULES.MIN_COLD}道以上凉菜`, `请选择${FEAST_RULES.MIN_HOT}道以上热菜`, `请选择${FEAST_RULES.MIN_SOUP}道以上汤品`];

        const renderDishCard = (dish, dishIndex) => {
            const isSelected = appState.selectedDishes.includes(dish.id);
            return `
                <div class="dish-select-card ${isSelected ? 'selected' : ''}" data-dish-id="${dish.id}" onclick="toggleDish('${dish.id}')">
                    <div class="dish-select-image-wrapper">
                        <img data-dish-id="${dish.id}" data-dish-name="${dish.name}" data-dish-index="${dishIndex}" alt="${dish.name}" class="dish-select-image" loading="lazy" src="https://picsum.photos/id/404/400/300" onerror="this.src='https://picsum.photos/id/404/400/300'">
                        <div class="dish-select-check">
                            ${isSelected ? '<span class="material-icons" style="font-size:20px;color:white;">check</span>' : '<span class="material-icons" style="font-size:16px;color:white;opacity:0.7;">visibility</span>'}
                        </div>
                    </div>
                    <div class="dish-select-content">
                        <div class="dish-select-name">${dish.name}</div>
                        <div class="dish-select-desc">${dish.description || ''}</div>
                        <div class="dish-select-price">${utils.formatPrice(dish.price)}</div>
                    </div>
                </div>
            `;
        };

        const renderProgressBar = () => {
            const steps = [
                { step: 1, label: '凉菜', completed: appState.customizeStep > 1, active: appState.customizeStep === 1 },
                { step: 2, label: '热菜', completed: appState.customizeStep > 2, active: appState.customizeStep === 2 },
                { step: 3, label: '汤品', completed: appState.customizeStep > 3, active: appState.customizeStep === 3 },
                { step: 4, label: '确认', completed: appState.customizeStep > 4, active: appState.customizeStep === 4 },
            ];
            return `
                <div class="step-progress">
                    ${steps.map((s, i) => `
                        <div class="step-item ${s.completed ? 'completed' : ''} ${s.active ? 'active' : ''}">
                            <div class="step-dot">${s.completed ? '<span class="material-icons">check</span>' : s.step}</div>
                            <div class="step-label">${s.label}</div>
                        </div>
                        ${i < steps.length - 1 ? `<div class="step-line ${s.completed ? 'completed' : ''}"></div>` : ''}
                    `).join('')}
                </div>
            `;
        };

        const canProceed = () => {
            if (appState.customizeStep === 1) return validation.cold >= FEAST_RULES.MIN_COLD;
            if (appState.customizeStep === 2) return validation.hot >= FEAST_RULES.MIN_HOT;
            if (appState.customizeStep === 3) return validation.soup >= FEAST_RULES.MIN_SOUP;
            return true;
        };

        const showSection = (category) => {
            const sectionMap = { '凉菜': 1, '热菜': 2, '汤品': 3 };
            return appState.customizeStep >= sectionMap[category];
        };

        return `
            <div class="page" style="padding-bottom: 120px;">
                <h1 class="page-title">定制套餐</h1>
                <p class="page-subtitle">${stepDesc[appState.customizeStep]}</p>

                ${renderProgressBar()}

                <!-- 当前步骤统计 -->
                <div class="card" style="margin-bottom: 16px; background: linear-gradient(135deg, var(--surface) 0%, rgba(196,92,72,0.1) 100%);">
                    <div style="display: flex; justify-content: space-around; padding: 12px 0;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: ${validation.cold >= FEAST_RULES.MIN_COLD ? 'var(--success)' : (appState.customizeStep === 1 ? 'var(--text-primary)' : 'var(--text-light)')};">${validation.cold}</div>
                            <div style="font-size: 12px; color: var(--text-light);">凉菜 (≥${FEAST_RULES.MIN_COLD})</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: ${validation.hot >= FEAST_RULES.MIN_HOT ? 'var(--success)' : (appState.customizeStep >= 2 ? 'var(--text-primary)' : 'var(--text-light)')};">${validation.hot}</div>
                            <div style="font-size: 12px; color: var(--text-light);">热菜 (≥${FEAST_RULES.MIN_HOT})</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: ${validation.soup >= FEAST_RULES.MIN_SOUP ? 'var(--success)' : (appState.customizeStep >= 3 ? 'var(--text-primary)' : 'var(--text-light)')};">${validation.soup}</div>
                            <div style="font-size: 12px; color: var(--text-light);">汤品 (≥${FEAST_RULES.MIN_SOUP})</div>
                        </div>
                    </div>
                </div>

                <!-- 搜索框 -->
                <div class="form-group" style="margin-bottom: 12px;">
                    <div style="position: relative;">
                        <span class="material-icons" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-light);">search</span>
                        <input type="text" class="form-input" placeholder="搜索菜品名称..." id="dishSearchInput" oninput="filterCustomizeDishes(this.value)" style="padding-left: 44px;">
                    </div>
                </div>

                <!-- 凉菜区 -->
                ${showSection('凉菜') ? `
                <div class="dish-select-section">
                    <div class="section-header">
                        <span class="section-title"><span class="material-icons" style="color:var(--info);">ac_unit</span> 凉菜</span>
                        <span class="section-badge ${validation.cold >= FEAST_RULES.MIN_COLD ? 'pass' : ''}">${validation.cold}/${FEAST_RULES.MIN_COLD}</span>
                    </div>
                    <div class="dish-select-grid">
                        ${coldDishes.map(renderDishCard).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 热菜区 -->
                ${showSection('热菜') ? `
                <div class="dish-select-section">
                    <div class="section-header">
                        <span class="section-title"><span class="material-icons" style="color:var(--price);">local_fire_department</span> 热菜</span>
                        <span class="section-badge ${validation.hot >= FEAST_RULES.MIN_HOT ? 'pass' : ''}">${validation.hot}/${FEAST_RULES.MIN_HOT}</span>
                    </div>
                    <div class="dish-select-grid">
                        ${hotDishes.map(renderDishCard).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 汤品区 -->
                ${showSection('汤品') ? `
                <div class="dish-select-section">
                    <div class="section-header">
                        <span class="section-title"><span class="material-icons" style="color:var(--warning);">soup_kitchen</span> 汤品</span>
                        <span class="section-badge ${validation.soup >= FEAST_RULES.MIN_SOUP ? 'pass' : ''}">${validation.soup}/${FEAST_RULES.MIN_SOUP}</span>
                    </div>
                    <div class="dish-select-grid">
                        ${soupDishes.map(renderDishCard).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 底部操作栏 -->
                <div class="submit-bar">
                    <div class="submit-bar-body" style="justify-content: space-between;">
                        <button class="btn btn-secondary" onclick="prevCustomizeStep()" ${appState.customizeStep === 1 ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                            <span class="material-icons">arrow_back</span>
                            上一步
                        </button>
                        <div style="text-align: center;">
                            <div style="font-size:12px;color:var(--text-light);">已选 ${appState.selectedDishes.length} 道</div>
                            <div style="font-size:16px;font-weight:600;color:var(--price);">${utils.formatPrice(totalPrice)}/席</div>
                        </div>
                        <button class="btn ${canProceed() ? 'btn-primary' : 'btn-secondary'}" onclick="nextCustomizeStep()">
                            ${appState.customizeStep === 3 ? '确认套餐' : '下一步'}
                            <span class="material-icons">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ---------- 确认套餐页面 ----------
    customizeConfirm() {
        const perTablePrice = dataManager.calcTotalPrice(appState.selectedDishes);
        const selectedDishes = appState.selectedDishes.map(id => dataManager.getDishById(id)).filter(Boolean);
        const coldDishes = selectedDishes.filter(d => d.category === '凉菜');
        const hotDishes = selectedDishes.filter(d => d.category === '热菜');
        const soupDishes = selectedDishes.filter(d => d.category === '汤品');

        return `
            <div class="page">
                <h1 class="page-title">确认套餐</h1>
                <p class="page-subtitle">确认所选菜品并设置席数</p>

                <!-- 进度条 -->
                <div class="step-progress">
                    <div class="step-item completed"><div class="step-dot"><span class="material-icons">check</span></div><div class="step-label">凉菜</div></div>
                    <div class="step-line completed"></div>
                    <div class="step-item completed"><div class="step-dot"><span class="material-icons">check</span></div><div class="step-label">热菜</div></div>
                    <div class="step-line completed"></div>
                    <div class="step-item completed"><div class="step-dot"><span class="material-icons">check</span></div><div class="step-label">汤品</div></div>
                    <div class="step-line completed"></div>
                    <div class="step-item active"><div class="step-dot">4</div><div class="step-label">确认</div></div>
                </div>

                <!-- 菜品清单 -->
                <div class="card">
                    <h3 class="card-title mb-md">菜品清单（${selectedDishes.length}道）</h3>
                    
                    ${coldDishes.length > 0 ? `
                    <div style="margin-bottom:10px;">
                        <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">凉菜（${coldDishes.length}道）</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${coldDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${hotDishes.length > 0 ? `
                    <div style="margin-bottom:10px;">
                        <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">热菜（${hotDishes.length}道）</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${hotDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${soupDishes.length > 0 ? `
                    <div style="margin-bottom:10px;">
                        <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">汤品（${soupDishes.length}道）</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${soupDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:2px solid var(--border);">
                        <span style="font-size:14px;color:var(--text-secondary);">每席价格</span>
                        <span style="font-size:20px;font-weight:700;color:var(--price);">${utils.formatPrice(perTablePrice)}</span>
                    </div>
                </div>

                <!-- 席数设置 -->
                <div class="card">
                    <h3 class="card-title mb-md">设置席数</h3>
                    <div style="display:flex;justify-content:space-around;align-items:center;padding:20px 0;">
                        <div style="text-align:center;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:8px;">主席</div>
                            <div style="display:flex;align-items:center;gap:16px;">
                                <button class="btn btn-secondary" onclick="changeMainTables(-1)" style="width:48px;height:48px;border-radius:50%;"><span class="material-icons" style="font-size:20px;">remove</span></button>
                                <span style="font-size:32px;font-weight:700;color:var(--text-primary);min-width:60px;text-align:center;">${appState.mainTables}</span>
                                <button class="btn btn-secondary" onclick="changeMainTables(1)" style="width:48px;height:48px;border-radius:50%;"><span class="material-icons" style="font-size:20px;">add</span></button>
                            </div>
                            <div style="font-size:11px;color:var(--text-light);margin-top:8px;">确定要做的席数</div>
                        </div>
                        <div style="width:1px;height:60px;background:var(--border);"></div>
                        <div style="text-align:center;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:8px;">备席</div>
                            <div style="display:flex;align-items:center;gap:16px;">
                                <button class="btn btn-secondary" onclick="changeBackupTables(-1)" style="width:48px;height:48px;border-radius:50%;"><span class="material-icons" style="font-size:20px;">remove</span></button>
                                <span style="font-size:32px;font-weight:700;color:var(--text-primary);min-width:60px;text-align:center;">${appState.backupTables}</span>
                                <button class="btn btn-secondary" onclick="changeBackupTables(1)" style="width:48px;height:48px;border-radius:50%;"><span class="material-icons" style="font-size:20px;">add</span></button>
                            </div>
                            <div style="font-size:11px;color:var(--text-light);margin-top:8px;">预防加桌预备</div>
                        </div>
                    </div>
                    <div style="padding:12px;background:rgba(196,92,72,0.08);border-radius:8px;text-align:center;">
                        <span style="font-size:14px;color:var(--text-secondary);">总计：</span>
                        <span style="font-size:24px;font-weight:700;color:var(--price);">${appState.mainTables + appState.backupTables}席</span>
                        <span style="font-size:14px;color:var(--text-secondary);">（按主席${appState.mainTables}席计费）</span>
                    </div>
                </div>

                <!-- 订单金额预览 -->
                <div class="card" style="background: linear-gradient(135deg, rgba(91,95,239,0.1) 0%, rgba(196,92,72,0.1) 100%);">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;">
                        <span style="font-size:16px;color:var(--text-secondary);">订单金额</span>
                        <span style="font-size:28px;font-weight:700;color:var(--price);">${utils.formatPrice(perTablePrice * appState.mainTables)}</span>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div style="display:flex;gap:12px;">
                    <button class="btn btn-secondary btn-block" onclick="appState.customizeStep=3;navigateTo('customize')">返回修改菜品</button>
                    <button class="btn btn-primary btn-block" onclick="goToCustomizeForm()">填写客户信息</button>
                </div>
            </div>
        `;
    },

    // ---------- 填写客户信息（选菜完成后） ----------
    customizeForm() {
        const perTablePrice = dataManager.calcTotalPrice(appState.selectedDishes);
        const totalPrice = perTablePrice * appState.mainTables;
        const isCustom = !appState.selectedPackage; // 是否为定制套餐

        // 获取菜品详情，按分类分组
        const selectedDishes = appState.selectedDishes.map(id => dataManager.getDishById(id)).filter(Boolean);
        const coldDishes = selectedDishes.filter(d => d.category === '凉菜');
        const hotDishes = selectedDishes.filter(d => d.category === '热菜');
        const soupDishes = selectedDishes.filter(d => d.category === '汤品');
        const otherDishes = selectedDishes.filter(d => !['凉菜','热菜','汤品'].includes(d.category));

        return `
            <div class="page">
                <h1 class="page-title">${isCustom ? '填写客户信息' : (appState.selectedPackage.name + ' - 下单')}</h1>
                <p class="page-subtitle">${isCustom ? '确认菜品信息并填写客户资料' : '确认套餐信息并填写客户资料'}</p>

                <div class="card">
                    <h3 class="card-title mb-md">菜品清单（${selectedDishes.length}道）</h3>
                    ${coldDishes.length > 0 ? `
                        <div style="margin-bottom:10px;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">凉菜（${coldDishes.length}道）</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${coldDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${hotDishes.length > 0 ? `
                        <div style="margin-bottom:10px;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">热菜（${hotDishes.length}道）</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${hotDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${soupDishes.length > 0 ? `
                        <div style="margin-bottom:10px;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">汤品（${soupDishes.length}道）</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${soupDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${otherDishes.length > 0 ? `
                        <div style="margin-bottom:10px;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">其他（${otherDishes.length}道）</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${otherDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:2px solid var(--border);">
                        <span style="font-size:14px;color:var(--text-secondary);">每席价格</span>
                        <span style="font-size:16px;font-weight:600;color:var(--text-primary);">${utils.formatPrice(perTablePrice)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;">
                        <span style="font-size:14px;color:var(--text-secondary);">${appState.mainTables}备${appState.backupTables}（${appState.mainTables + appState.backupTables}席）</span>
                        <span style="font-size:22px;font-weight:700;color:var(--price);">${utils.formatPrice(totalPrice)}</span>
                    </div>
                </div>

                <div class="card">
                    <h3 class="card-title mb-md">客户信息</h3>
                    <form id="orderForm" onsubmit="submitCustomOrder(event)">
                        <div class="form-group">
                            <label class="form-label">客户姓名 *</label>
                            <input type="text" class="form-input" name="customerName" required placeholder="请输入客户姓名" maxlength="5">
                        </div>
                        <div class="form-group">
                            <label class="form-label">联系电话 *</label>
                            <input type="tel" class="form-input" name="phone" required placeholder="请输入联系电话" pattern="1[3-9]\\d{9}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">宴席地址</label>
                            <input type="text" class="form-input" name="address" placeholder="请输入宴席举办地址（选填）">
                        </div>
                        <div class="form-group">
                            <label class="form-label">宴席日期 *</label>
                            <input type="date" class="form-input" name="date" required min="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">席数 * <small style="color:var(--text-light);font-weight:400;">（如：8备2）</small></label>
                            <div style="display:flex;gap:12px;align-items:center;">
                                <div style="flex:1;">
                                    <input type="number" class="form-input" name="mainTables" required min="1" max="200" value="${appState.mainTables || 1}" placeholder="主席" oninput="updateTotalTablesDisplay(this)">
                                    <div style="font-size:11px;color:var(--text-light);margin-top:2px;">主席（确定做）</div>
                                </div>
                                <span style="color:var(--text-light);">备</span>
                                <div style="flex:1;">
                                    <input type="number" class="form-input" name="backupTables" min="0" max="50" value="${appState.backupTables || 0}" placeholder="备席" oninput="updateTotalTablesDisplay(this)">
                                    <div style="font-size:11px;color:var(--text-light);margin-top:2px;">备席（预防加桌）</div>
                                </div>
                            </div>
                            <div style="margin-top:8px;padding:8px 12px;background:rgba(196,92,72,0.08);border-radius:8px;font-size:13px;color:var(--text-secondary);">
                                总计：<strong style="color:var(--primary);" id="customizeTotalTables">${(appState.mainTables || 1) + (appState.backupTables || 0)}席</strong>（按主席计费，备席食材预备）
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">备注信息</label>
                            <textarea class="form-input form-textarea" name="notes" placeholder="请输入特殊要求或备注信息（选填）"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">提交订单</button>
                        ${isCustom ? `<button type="button" class="btn btn-secondary btn-block mt-sm" onclick="navigateTo('customize')">返回修改菜品</button>` : `<button type="button" class="btn btn-secondary btn-block mt-sm" onclick="navigateTo('packages')">返回选择套餐</button>`}
                    </form>
                </div>
            </div>
        `;
    },

    // ---------- 菜品管理 ----------
    dishes() {
        let dishes = dataManager.getDishes();
        if (appState.searchKeyword) {
            dishes = dishes.filter(d => d.name.toLowerCase().includes(appState.searchKeyword.toLowerCase()));
        }
        const categories = ['全部', ...new Set(dataManager.getDishes().map(d => d.category))];

        return `
            <div class="page">
                <h1 class="page-title">菜品管理</h1>
                <p class="page-subtitle">管理菜品信息</p>

                <div class="form-group">
                    <div style="position: relative;">
                        <span class="material-icons" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-light);">search</span>
                        <input type="text" class="form-input" placeholder="搜索菜品..." value="${appState.searchKeyword}"
                               oninput="searchDishes(this.value)" style="padding-left: 44px;">
                        ${appState.searchKeyword ? `<span class="material-icons" onclick="clearSearch()" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-light);">close</span>` : ''}
                    </div>
                </div>

                <div class="category-filter">
                    ${categories.map((cat, i) => `
                        <span class="category-chip ${i === 0 ? 'active' : ''}" onclick="filterDishes('${cat}', this)">${cat}</span>
                    `).join('')}
                </div>

                <div class="dish-grid" id="dishGrid">
                    ${dishes.length === 0 ?
                        '<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-state-icon"><span class="material-icons">search_off</span></div><div class="empty-state-text">没有找到匹配的菜品</div></div>' :
                        dishes.map((dish, idx) => `
                            <div class="dish-card" data-category="${dish.category}" onclick="showDishDetail('${dish.id}')" style="cursor: pointer;">
                                <div class="dish-card-image">
                                    <img data-dish-id="${dish.id}" data-dish-name="${dish.name}" data-dish-index="${idx}" alt="${dish.name}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" src="https://picsum.photos/id/404/400/300" onerror="this.parentElement.style.display='none'">
                                </div>
                                <div class="dish-content">
                                    <span class="dish-category">${dish.category}</span>
                                    <h4 class="dish-name">${dish.name}</h4>
                                    <p style="font-size:12px;color:var(--text-light);margin:4px 0;">${dish.description || ''}</p>
                                    <div class="dish-price">${utils.formatPrice(dish.price)}</div>
                                    <div class="mt-sm" style="display: flex; gap: 8px;">
                                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editDish('${dish.id}')">编辑</button>
                                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteDish('${dish.id}')">删除</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
            <button class="btn-fab" onclick="showAddDishModal()">
                <span class="material-icons">add</span>
            </button>
        `;
    },

    // ---------- 套餐管理 ----------
    packagesManage() {
        let packages = dataManager.getPackages();
        if (appState.searchKeyword) {
            packages = packages.filter(p => p.name.toLowerCase().includes(appState.searchKeyword.toLowerCase()));
        }

        return `
            <div class="page">
                <h1 class="page-title">套餐管理</h1>
                <p class="page-subtitle">管理套餐信息</p>

                <div class="form-group">
                    <div style="position: relative;">
                        <span class="material-icons" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-light);">search</span>
                        <input type="text" class="form-input" placeholder="搜索套餐..." value="${appState.searchKeyword}"
                               oninput="searchPackages(this.value)" style="padding-left: 44px;">
                        ${appState.searchKeyword ? `<span class="material-icons" onclick="clearSearch()" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-light);">close</span>` : ''}
                    </div>
                </div>

                ${packages.length === 0 ?
                    '<div class="empty-state"><div class="empty-state-icon"><span class="material-icons">search_off</span></div><div class="empty-state-text">没有找到匹配的套餐</div></div>' :
                    packages.map(pkg => {
                        const dishCount = pkg.includedDishes ? pkg.includedDishes.length : 0;
                        return `
                            <div class="package-card">
                                <div class="package-content">
                                    <h3 class="package-title">${pkg.name}</h3>
                                    <p class="package-description">${pkg.description}</p>
                                    <div style="font-size:12px;color:var(--text-light);margin-bottom:8px;">包含${dishCount}道菜品</div>
                                    <div class="package-footer">
                                        <div>
                                            <span class="package-price">${utils.formatPrice(pkg.currentPrice)}</span>
                                            ${pkg.originalPrice > pkg.currentPrice ?
                                                `<span class="package-original-price">${utils.formatPrice(pkg.originalPrice)}</span>` : ''}
                                        </div>
                                        <div style="display: flex; gap: 8px;">
                                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editPackage('${pkg.id}')">编辑</button>
                                            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deletePackage('${pkg.id}')">删除</button>
                                        </div>
                                    </div>
                                    ${pkg.suitableFor ? `<span class="dish-category" style="margin-top:8px;">每席${pkg.suitableFor}人</span>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
            <button class="btn-fab" onclick="showAddPackageModal()">
                <span class="material-icons">add</span>
            </button>
        `;
    },

    // ---------- 排程日历 ----------
    schedule() {
        const year = appState.currentMonth.getFullYear();
        const month = appState.currentMonth.getMonth();
        const orders = dataManager.getOrdersByMonth(year, month);

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const orderDates = new Set(orders.map(o => new Date(o.date).getDate()));
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

        return `
            <div class="page">
                <h1 class="page-title">排程日历</h1>
                <p class="page-subtitle">查看和管理订单排程</p>

                <div class="calendar-header">
                    <h2 class="calendar-title">${year}年${month + 1}月</h2>
                    <div class="calendar-nav">
                        <button onclick="changeMonth(-1)"><span class="material-icons">chevron_left</span></button>
                        <button onclick="resetToToday()"><span class="material-icons">today</span></button>
                        <button onclick="changeMonth(1)"><span class="material-icons">chevron_right</span></button>
                    </div>
                </div>

                <div class="card">
                    <div class="calendar-grid">
                        ${weekdays.map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
                        ${Array(startWeekday).fill('<div></div>').join('')}
                        ${Array(daysInMonth).fill(0).map((_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month, day);
                            const isToday = date.toDateString() === new Date().toDateString();
                            const isSelected = appState.selectedDate && date.toDateString() === appState.selectedDate.toDateString();
                            const hasOrders = orderDates.has(day);
                            return `
                                <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasOrders ? 'has-orders' : ''}"
                                     data-day="${day}" onclick="selectDate('${date.toISOString()}')">
                                    ${day}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">${appState.selectedDate ? utils.formatDateShort(appState.selectedDate) : '本月'}订单</h2>
                        ${appState.selectedDate ? `<button class="btn btn-sm btn-secondary" onclick="clearDateFilter()">查看全部</button>` : ''}
                    </div>
                    <div class="schedule-orders">
                    ${this.renderScheduleOrders()}
                    </div>
                </div>
            </div>
        `;
    },

    renderScheduleOrders() {
        let orders;
        if (appState.selectedDate) {
            orders = dataManager.getOrdersByDate(appState.selectedDate);
        } else {
            const year = appState.currentMonth.getFullYear();
            const month = appState.currentMonth.getMonth();
            orders = dataManager.getOrdersByMonth(year, month);
        }
        orders = orders.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (orders.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon"><span class="material-icons">event_busy</span></div>
                    <div class="empty-state-text">暂无订单</div>
                </div>
            `;
        }
        return orders.map(order => this.renderOrderItem(order)).join('');
    },

    // ---------- 客户通讯录 ----------
    customers() {
        const allOrders = dataManager.getOrders();
        const customerMap = {};

        allOrders.forEach(order => {
            const key = (order.customerName || '') + '|' + (order.phone || '');
            if (!customerMap[key]) {
                customerMap[key] = {
                    name: order.customerName || '未知客户',
                    phone: order.phone || '',
                    orderCount: 0,
                    lastDate: '',
                    orders: []
                };
            }
            customerMap[key].orderCount++;
            customerMap[key].orders.push(order);
            const orderDate = new Date(order.date).toISOString().split('T')[0];
            if (!customerMap[key].lastDate || orderDate > customerMap[key].lastDate) {
                customerMap[key].lastDate = orderDate;
            }
        });

        let customers = Object.values(customerMap);

        // 搜索过滤
        if (appState.searchKeyword) {
            const kw = appState.searchKeyword.toLowerCase();
            customers = customers.filter(c =>
                c.name.toLowerCase().includes(kw) || c.phone.includes(kw)
            );
        }

        // 按最近订单日期倒序
        customers.sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));

        return `
            <div class="page">
                <h1 class="page-title">客户通讯录</h1>
                <p class="page-subtitle">共 ${customers.length} 位客户</p>

                <div class="card" style="background: linear-gradient(135deg, #C45C48 0%, #D4A574 100%); border: none; margin-bottom: 16px;">
                    <button onclick="aiAnalyzeAllCustomers()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: none; border: none; color: #fff; cursor: pointer; font-size: 15px; font-weight: 600; border-radius: 12px;">
                        <span class="material-icons" style="font-size: 22px;">auto_awesome</span>
                        AI 分析所有客户 & 优化菜品
                    </button>
                </div>

                <div id="aiAnalysisResult" style="display: none; margin-bottom: 16px; padding: 16px; background: var(--surface); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); font-size: 14px; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word; max-height: 60vh; overflow-y: auto;"></div>

                <div class="form-group">
                    <div style="position: relative;">
                        <span class="material-icons" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-light);">search</span>
                        <input type="text" class="form-input" placeholder="搜索姓名或电话..." value="${appState.searchKeyword}"
                               oninput="searchCustomers(this.value)" style="padding-left: 44px;">
                        ${appState.searchKeyword ? `<span class="material-icons" onclick="clearSearch()" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-light);">close</span>` : ''}
                    </div>
                </div>

                ${customers.length === 0 ?
                    '<div class="empty-state"><div class="empty-state-icon"><span class="material-icons">contacts</span></div><div class="empty-state-text">暂无客户信息</div></div>' :
                    customers.map((c, idx) => `
                        <div class="card" style="margin-bottom: 12px; cursor: pointer;" onclick="toggleCustomerDetail(${idx})">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${c.name}</div>
                                    <div style="font-size: 13px; color: var(--text-light); margin-top: 4px;">
                                        <span class="material-icons" style="font-size: 14px; vertical-align: middle;">phone</span>
                                        ${c.phone || '未填写'}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 13px; color: var(--text-secondary);">${c.orderCount} 笔订单</div>
                                    <div style="font-size: 12px; color: var(--text-light); margin-top: 2px;">最近: ${c.lastDate || '-'}</div>
                                </div>
                            </div>
                            <div id="customerDetail_${idx}" style="display: none; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;">
                                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">历史订单</div>
                                ${c.orders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => {
                                    const pkg = dataManager.getPackageById(order.packageId);
                                    const statusText = { pending: '待确认', confirmed: '已确认', cancelled: '已取消' }[order.status];
                                    const statusClass = order.status;
                                    return `
                                        <div class="order-item" onclick="event.stopPropagation(); showOrderDetail('${order.id}')">
                                            <div class="order-header">
                                                <span class="order-customer">${utils.formatDateShort(order.date)}</span>
                                                <span class="order-status ${statusClass}">${statusText}</span>
                                            </div>
                                            <div class="order-details">
                                                ${pkg ? pkg.name : '定制套餐'} · ${order.mainTables || order.tableCount || '-'}备${order.backupTables || '0'}
                                                ${order.address ? `<br><span style="font-size:12px;color:var(--text-light);"><span class="material-icons" style="font-size:12px;vertical-align:middle;margin-right:2px;">location_on</span>${order.address}</span>` : ''}
                                            </div>
                                            <div class="order-price">${utils.formatPrice(order.totalPrice)}</div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
    },

};

// ==================== 导航 ====================

function navigateTo(page) {
    appState.currentPage = page;
    appState.searchKeyword = '';

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    const app = document.getElementById('app');
    if (pages[page]) {
        app.innerHTML = pages[page]();
    }

    // 异步加载菜品自定义图片
    initDishImages();

    window.scrollTo(0, 0);

    // 原生震动反馈
    if (window.NativeHaptics) NativeHaptics.light();
}

/**
 * AI 分析客户画像
 */
/**
 * AI 分析所有客户 & 菜品优化
 */
async function aiAnalyzeAllCustomers() {
    const resultDiv = document.getElementById('aiAnalysisResult');
    if (!resultDiv) return;

    const allOrders = dataManager.getOrders().filter(o => o.status === 'confirmed');
    const allDishes = dataManager.getDishes();
    const allPackages = dataManager.getPackages();

    if (allOrders.length === 0) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-light);"><span class="material-icons" style="font-size:40px;display:block;margin-bottom:8px;">analytics</span>暂无已确认的订单数据</div>';
        return;
    }

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div style="text-align:center;padding:24px;">
            <div class="ai-loading-spinner"></div>
            <div style="margin-top:12px;color:var(--text-secondary);font-size:14px;">AI 正在分析经营数据...</div>
        </div>`;

    // 整理数据
    const ordersData = allOrders.map(o => {
        const pkg = dataManager.getPackageById(o.packageId);
        const dishes = (o.selectedDishes || []).map(id => {
            const d = dataManager.getDishById(id);
            return d ? { name: d.name, category: d.category, price: d.price } : null;
        }).filter(Boolean);
        return {
            date: o.date,
            tables: o.mainTables || o.tableCount || 0,
            price: o.totalPrice || 0,
            packageName: pkg ? pkg.name : '定制',
            dishes: dishes
        };
    });

    // 统计菜品频次
    const dishStats = {};
    ordersData.forEach(o => {
        o.dishes.forEach(d => {
            if (!dishStats[d.name]) dishStats[d.name] = { count: 0, totalRevenue: 0 };
            dishStats[d.name].count++;
            dishStats[d.name].totalRevenue += d.price * (o.tables);
        });
    });

    const topDishes = Object.entries(dishStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, stats]) => `${name}(${stats.count}次)`);

    // 月度统计
    const monthlyStats = {};
    ordersData.forEach(o => {
        const month = o.date.substring(0, 7);
        if (!monthlyStats[month]) monthlyStats[month] = { count: 0, revenue: 0, tables: 0 };
        monthlyStats[month].count++;
        monthlyStats[month].revenue += o.price;
        monthlyStats[month].tables += o.tables;
    });

    const monthlyText = Object.entries(monthlyStats)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .map(([m, s]) => `${m}: ${s.count}单/${s.tables}席/¥${s.revenue}`)
        .join('\n');

    const dishLibrary = allDishes.map(d => ({ name: d.name, category: d.category, price: d.price }));
    const orderedDishNames = new Set(Object.keys(dishStats));
    const neverOrdered = dishLibrary.filter(d => !orderedDishNames.has(d.name));

    // 计算统计数据
    const totalRevenue = ordersData.reduce((s, o) => s + o.price, 0);
    const avgPrice = ordersData.length > 0 ? Math.round(totalRevenue / ordersData.length) : 0;
    const avgTables = ordersData.length > 0 ? (ordersData.reduce((s, o) => s + o.tables, 0) / ordersData.length).toFixed(1) : 0;

    try {
        const analysis = await AIService.analyzeAllCustomers({
            orders: ordersData,
            topDishes, monthlyStats: monthlyText,
            dishCount: allDishes.length,
            packageCount: allPackages.length,
            dishLibrary,
            neverOrdered: neverOrdered.map(d => d.name),
            avgPrice, avgTables, totalRevenue
        });

        // 渲染结构化分析结果
        renderAnalysisResult(resultDiv, analysis);
        if (window.NativeHaptics) window.NativeHaptics.success();
    } catch(e) {
        resultDiv.innerHTML = `<div style="text-align:center;padding:16px;color:var(--error);"><span class="material-icons" style="font-size:32px;display:block;margin-bottom:8px;">error_outline</span>分析失败: ${e.message}</div>`;
    }
}

/**
 * 渲染AI分析结果 - 结构化卡片
 */
function renderAnalysisResult(container, data) {
    if (data.parseError) {
        // JSON解析失败，降级为纯文本
        container.innerHTML = `<div style="padding:16px;font-size:14px;line-height:1.8;white-space:pre-wrap;">${data.summary}</div>`;
        return;
    }

    const typeConfig = {
        add: { label: '新增', color: '#8B9A7B', icon: 'add_circle', bg: 'rgba(139,154,123,0.1)' },
        remove: { label: '删减', color: '#C45C48', icon: 'remove_circle', bg: 'rgba(196,92,72,0.1)' },
        push: { label: '主推', color: '#D4A574', icon: 'trending_up', bg: 'rgba(212,165,116,0.15)' }
    };

    container.innerHTML = `
        <!-- 一句话总结 -->
        <div class="ai-summary-card">
            <span class="material-icons" style="font-size:20px;color:var(--primary);">auto_awesome</span>
            <span>${data.summary || '分析完成'}</span>
        </div>

        <!-- 关键数据 -->
        ${data.metrics ? `
        <div class="ai-metrics-grid">
            <div class="ai-metric-item">
                <div class="ai-metric-value">${data.metrics.totalOrders || 0}</div>
                <div class="ai-metric-label">总订单</div>
            </div>
            <div class="ai-metric-item">
                <div class="ai-metric-value">¥${(data.metrics.totalRevenue || 0).toLocaleString()}</div>
                <div class="ai-metric-label">总营收</div>
            </div>
            <div class="ai-metric-item">
                <div class="ai-metric-value">¥${data.metrics.avgPrice || 0}</div>
                <div class="ai-metric-label">客单价</div>
            </div>
            <div class="ai-metric-item">
                <div class="ai-metric-value">${data.metrics.avgTables || 0}</div>
                <div class="ai-metric-label">平均席数</div>
            </div>
        </div>` : ''}

        <!-- 关键发现 -->
        ${data.highlights && data.highlights.length > 0 ? `
        <div class="ai-section">
            <div class="ai-section-title"><span class="material-icons" style="font-size:18px;">insights</span> 关键发现</div>
            <div class="ai-highlight-list">
                ${data.highlights.map(h => `
                    <div class="ai-highlight-item" style="border-left: 3px solid ${h.color || 'var(--primary)'};">
                        <div class="ai-highlight-title">${h.title || ''}</div>
                        <div class="ai-highlight-desc">${h.desc || ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <!-- 热门菜品 -->
        ${data.topDishes && data.topDishes.length > 0 ? `
        <div class="ai-section">
            <div class="ai-section-title"><span class="material-icons" style="font-size:18px;">local_fire_department</span> 热门菜品</div>
            <div class="ai-dish-tags">
                ${data.topDishes.map(d => `
                    <div class="ai-dish-tag hot">
                        <span class="ai-dish-tag-name">${d.name}</span>
                        <span class="ai-dish-tag-count">${d.count || 0}次</span>
                        ${d.tag ? `<span class="ai-dish-tag-label">${d.tag}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <!-- 冷门菜品 -->
        ${data.coldDishes && data.coldDishes.length > 0 ? `
        <div class="ai-section">
            <div class="ai-section-title"><span class="material-icons" style="font-size:18px;">ac_unit</span> 冷门菜品</div>
            <div class="ai-cold-list">
                ${data.coldDishes.map(d => `
                    <div class="ai-cold-item">
                        <span class="ai-cold-name">${d.name}</span>
                        <span class="ai-cold-reason">${d.reason || '暂无数据'}</span>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <!-- 优化建议 -->
        ${data.suggestions && data.suggestions.length > 0 ? `
        <div class="ai-section">
            <div class="ai-section-title"><span class="material-icons" style="font-size:18px;">lightbulb</span> 优化建议</div>
            <div class="ai-suggestion-list">
                ${data.suggestions.map(s => {
                    const cfg = typeConfig[s.type] || typeConfig.push;
                    return `
                    <div class="ai-suggestion-item" style="background:${cfg.bg};">
                        <span class="material-icons" style="font-size:18px;color:${cfg.color};">${cfg.icon}</span>
                        <div class="ai-suggestion-content">
                            <span class="ai-suggestion-type" style="color:${cfg.color};">${cfg.label}</span>
                            <span class="ai-suggestion-dish">${s.dish || ''}</span>
                            <span class="ai-suggestion-reason">${s.reason || ''}</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>` : ''}
    `;

    // 添加入场动画
    container.querySelectorAll('.ai-section, .ai-summary-card, .ai-metrics-grid').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(12px)';
        el.style.transition = 'all 0.4s ease';
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 100 + i * 80);
    });
}

// ==================== 套餐选择 & 定制选菜 ====================

function selectPackage(packageId) {
    appState.selectedPackage = dataManager.getPackageById(packageId);
    // 固定套餐：直接进入填写信息页，菜品不可修改
    appState.selectedDishes = [...(appState.selectedPackage.includedDishes || [])];
    appState.mainTables = 1;
    appState.backupTables = 0;
    navigateTo('customizeForm');
}

function startCustomize() {
    // 定制套餐：从空开始选菜，第一步选凉菜
    appState.selectedPackage = null;
    appState.selectedDishes = [];
    appState.customizeStep = 1;
    appState.mainTables = 1;
    appState.backupTables = 0;
    navigateTo('customize');
}

function toggleDish(dishId) {
    const idx = appState.selectedDishes.indexOf(dishId);
    if (idx === -1) {
        appState.selectedDishes.push(dishId);
    } else {
        appState.selectedDishes.splice(idx, 1);
    }
    // 局部更新：只更新相关DOM元素，不重新渲染整个页面
    updateCustomizeUI();
}

// 搜索过滤菜品
function filterCustomizeDishes(keyword) {
    const kw = keyword.toLowerCase().trim();
    document.querySelectorAll('.dish-select-card').forEach(card => {
        const dishId = card.dataset.dishId;
        const dish = dataManager.getDishById(dishId);
        if (!dish) return;
        const match = !kw || dish.name.toLowerCase().includes(kw) || (dish.description || '').toLowerCase().includes(kw);
        card.style.display = match ? '' : 'none';
    });
}

// 套餐对比弹窗
function showPackageCompare() {
    const packages = dataManager.getPackages();
    if (packages.length === 0) {
        utils.showToast('暂无套餐可对比');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90vw; overflow-x: auto;">
            <div class="modal-header">
                <h2 class="modal-title">套餐对比</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div style="padding: 16px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: var(--primary); color: white;">
                            <th style="padding: 12px 8px; text-align: left; white-space: nowrap;">对比项</th>
                            ${packages.map(pkg => `<th style="padding: 12px 8px; text-align: center; white-space: nowrap;">${pkg.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: var(--surface);">
                            <td style="padding: 8px; border-bottom: 1px solid var(--border);">每席价格</td>
                            ${packages.map(pkg => `<td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: center; font-weight: 600; color: var(--price);">${utils.formatPrice(pkg.currentPrice)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border);">菜品总数</td>
                            ${packages.map(pkg => {
                                const count = pkg.includedDishes ? pkg.includedDishes.length : 0;
                                return `<td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: center;">${count}道</td>`;
                            }).join('')}
                        </tr>
                        <tr style="background: var(--surface);">
                            <td style="padding: 8px; border-bottom: 1px solid var(--border);">凉菜</td>
                            ${packages.map(pkg => {
                                const count = pkg.includedDishes ? pkg.includedDishes.filter(id => { const d = dataManager.getDishById(id); return d && d.category === '凉菜'; }).length : 0;
                                return `<td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: center;">${count}道</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border);">热菜</td>
                            ${packages.map(pkg => {
                                const count = pkg.includedDishes ? pkg.includedDishes.filter(id => { const d = dataManager.getDishById(id); return d && d.category === '热菜'; }).length : 0;
                                return `<td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: center;">${count}道</td>`;
                            }).join('')}
                        </tr>
                        <tr style="background: var(--surface);">
                            <td style="padding: 8px; border-bottom: 1px solid var(--border);">汤品</td>
                            ${packages.map(pkg => {
                                const count = pkg.includedDishes ? pkg.includedDishes.filter(id => { const d = dataManager.getDishById(id); return d && d.category === '汤品'; }).length : 0;
                                return `<td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: center;">${count}道</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border);">适合人数</td>
                            ${packages.map(pkg => `<td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: center;">${pkg.suitableFor || '10'}人/席</td>`).join('')}
                        </tr>
                        <tr style="background: var(--surface);">
                            <td style="padding: 8px; border-bottom: 1px solid var(--border);">菜品详情</td>
                            ${packages.map(pkg => {
                                const dishes = pkg.includedDishes ? pkg.includedDishes.map(id => dataManager.getDishById(id)).filter(Boolean) : [];
                                return `<td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left; font-size: 11px; line-height: 1.4;">${dishes.map(d => d.name).join('、') || '无'}</td>`;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
                <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
                    ${packages.map(pkg => `<button class="btn btn-primary" onclick="selectPackage('${pkg.id}'); this.closest('.modal-overlay').remove();">选择 ${pkg.name}</button>`).join('')}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 主席数增减
function changeMainTables(delta) {
    appState.mainTables = Math.max(1, Math.min(200, appState.mainTables + delta));
    updateCustomizeUI();
}

// 备席数增减
function changeBackupTables(delta) {
    appState.backupTables = Math.max(0, Math.min(50, appState.backupTables + delta));
    updateCustomizeUI();
}

// 实时更新填写信息页面的席数总计
function updateTotalTablesDisplay(input) {
    const form = input.closest('form');
    const main = parseInt(form.querySelector('[name="mainTables"]').value) || 0;
    const backup = parseInt(form.querySelector('[name="backupTables"]').value) || 0;
    const total = Math.max(1, main) + backup;
    const el = document.getElementById('customizeTotalTables');
    if (el) el.textContent = total + '席';
}

function goToCustomizeForm() {
    appState.customizeStep = 5;
    navigateTo('customizeForm');
}

function nextCustomizeStep() {
    const validation = dataManager.validateFeastRules(appState.selectedDishes);
    
    if (appState.customizeStep === 1) {
        if (validation.cold < FEAST_RULES.MIN_COLD) {
            customAlert({
                title: '凉菜未选够',
                message: `请至少选择${FEAST_RULES.MIN_COLD}道凉菜`,
                type: 'warning',
                confirmText: '继续选择'
            });
            return;
        }
        appState.customizeStep = 2;
        navigateTo('customize');
    } else if (appState.customizeStep === 2) {
        if (validation.hot < FEAST_RULES.MIN_HOT) {
            customAlert({
                title: '热菜未选够',
                message: `请至少选择${FEAST_RULES.MIN_HOT}道热菜`,
                type: 'warning',
                confirmText: '继续选择'
            });
            return;
        }
        appState.customizeStep = 3;
        navigateTo('customize');
    } else if (appState.customizeStep === 3) {
        if (validation.soup < FEAST_RULES.MIN_SOUP) {
            customAlert({
                title: '汤品未选够',
                message: `请至少选择${FEAST_RULES.MIN_SOUP}道汤品`,
                type: 'warning',
                confirmText: '继续选择'
            });
            return;
        }
        appState.customizeStep = 4;
        navigateTo('customizeConfirm');
    }
}

function prevCustomizeStep() {
    if (appState.customizeStep > 1) {
        appState.customizeStep--;
        navigateTo('customize');
    }
}

// 局部更新选菜页面UI（避免全页刷新）
function updateCustomizeUI() {
    const validation = dataManager.validateFeastRules(appState.selectedDishes);
    const totalPrice = dataManager.calcTotalPrice(appState.selectedDishes);

    // 更新每个菜品卡片的选中状态
    document.querySelectorAll('.dish-select-card').forEach(card => {
        const dishId = card.dataset.dishId;
        const isSelected = appState.selectedDishes.includes(dishId);
        card.classList.toggle('selected', isSelected);
        const checkIcon = card.querySelector('.dish-select-check');
        if (checkIcon) {
            checkIcon.innerHTML = isSelected ? '<span class="material-icons" style="font-size:20px;color:white;">check</span>' : '';
        }
    });

    // 更新底部浮动栏（分步流程：无席数选择）
    const submitBar = document.querySelector('.submit-bar');
    if (submitBar) {
        const canProceed = (appState.customizeStep === 1 && validation.cold >= FEAST_RULES.MIN_COLD) ||
                          (appState.customizeStep === 2 && validation.hot >= FEAST_RULES.MIN_HOT) ||
                          (appState.customizeStep === 3 && validation.soup >= FEAST_RULES.MIN_SOUP);
        submitBar.innerHTML = `
            <div class="submit-bar-body" style="justify-content: space-between;">
                <button class="btn btn-secondary" onclick="prevCustomizeStep()" ${appState.customizeStep === 1 ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                    <span class="material-icons">arrow_back</span>
                    上一步
                </button>
                <div style="text-align: center;">
                    <div style="font-size:12px;color:var(--text-light);">已选 ${appState.selectedDishes.length} 道</div>
                    <div style="font-size:16px;font-weight:600;color:var(--price);">${utils.formatPrice(totalPrice)}/席</div>
                </div>
                <button class="btn ${canProceed ? 'btn-primary' : 'btn-secondary'}" onclick="nextCustomizeStep()">
                    ${appState.customizeStep === 3 ? '确认套餐' : '下一步'}
                    <span class="material-icons">arrow_forward</span>
                </button>
            </div>
        `;
    }

    // 更新分类徽章
    document.querySelectorAll('.section-badge').forEach(badge => {
        const section = badge.closest('.dish-select-section');
        if (!section) return;
        const title = section.querySelector('.section-title')?.textContent || '';
        let count = 0, min = 0;
        if (title.includes('凉菜')) { count = validation.cold; min = FEAST_RULES.MIN_COLD; }
        else if (title.includes('热菜')) { count = validation.hot; min = FEAST_RULES.MIN_HOT; }
        else if (title.includes('汤品')) { count = validation.soup; min = FEAST_RULES.MIN_SOUP; }
        badge.textContent = `${count}/${min}`;
        badge.classList.toggle('pass', count >= min);
    });
}

async function submitCustomOrder(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const perTablePrice = dataManager.calcTotalPrice(appState.selectedDishes);
    const mainTables = parseInt(formData.get('mainTables')) || 1;
    const backupTables = parseInt(formData.get('backupTables')) || 0;
    const totalTables = mainTables + backupTables;

    const order = {
        id: utils.generateId('ord'),
        customerName: formData.get('customerName'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        date: new Date(formData.get('date')).toISOString(),
        mainTables: mainTables,
        backupTables: backupTables,
        totalTables: totalTables,
        perTablePrice: perTablePrice,
        packageId: appState.selectedPackage ? appState.selectedPackage.id : 'custom',
        totalPrice: perTablePrice * mainTables, // 按主席计费
        status: 'pending',
        createdAt: new Date().toISOString(),
        notes: formData.get('notes') || null,
        selectedDishes: [...appState.selectedDishes]
    };

    await dataManager.addOrder(order);
    utils.showToast('订单提交成功！');
    if (window.NativeHaptics) NativeHaptics.success();

    // 保存订单到全局，供 AI 话术生成使用
    window._currentOrder = order;

    // 清空选菜状态
    appState.selectedDishes = [];
    appState.selectedPackage = null;

    document.getElementById('app').innerHTML = `
        <div class="page" style="text-align: center; padding-top: 60px;">
            <div style="width: 80px; height: 80px; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                <span class="material-icons" style="font-size: 48px; color: var(--success);">check_circle</span>
            </div>
            <h1 class="page-title">订单提交成功！</h1>
            <p class="page-subtitle">我们会尽快与您联系确认订单详情</p>

            <div class="card" style="text-align: left; margin-top: 32px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">订单号</span>
                    <span>${order.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">客户姓名</span>
                    <span>${order.customerName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">联系电话</span>
                    <span>${order.phone}</span>
                </div>
                ${order.address ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">宴席地址</span>
                    <span>${order.address}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">宴席日期</span>
                    <span>${utils.formatDate(order.date)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">菜品数量</span>
                    <span>${order.selectedDishes.length}道</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">席数</span>
                    <span>${order.mainTables}备${order.backupTables}（共${order.totalTables}席）</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">每席价格</span>
                    <span>${utils.formatPrice(order.perTablePrice)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">订单金额</span>
                    <span style="color: var(--price); font-weight: 700; font-size: 18px;">${utils.formatPrice(order.totalPrice)}</span>
                </div>
            </div>

            <div style="margin-top:16px;">
                <button type="button" class="btn btn-secondary btn-block" onclick="aiGenerateConfirmMessage()" id="aiConfirmBtn">
                    <span class="material-icons" style="font-size:18px;">auto_awesome</span>
                    生成客户确认话术
                </button>
                <div id="aiConfirmResult" style="display:none;margin-top:12px;padding:12px;background:rgba(196,92,72,0.08);border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;position:relative;"></div>
            </div>

            <div style="margin-top:16px;">
                <button type="button" class="btn btn-primary btn-block" onclick="showMenuCard(window._currentOrder.id)">
                    <span class="material-icons" style="font-size:18px;">card_giftcard</span>
                    生成菜单卡片
                </button>
            </div>

            <button class="btn btn-primary btn-block" style="margin-top: 32px;" onclick="navigateTo('dashboard')">返回首页</button>
            <button class="btn btn-secondary btn-block mt-sm" onclick="navigateTo('packages')">继续下单</button>
        </div>
    `;
}

/**
 * 生成本地客户确认话术（模板填空）
 */
function aiGenerateConfirmMessage() {
    const btn = document.getElementById('aiConfirmBtn');
    const resultDiv = document.getElementById('aiConfirmResult');

    if (!btn || !resultDiv) return;

    const order = window._currentOrder || {};

    // 格式化日期
    let dateStr = '待定';
    if (order.date) {
        try {
            const d = new Date(order.date);
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekDay = weekDays[d.getDay()];
            dateStr = `${d.getFullYear()}年${month}月${day}日（周${weekDay}）`;
        } catch(e) {}
    }

    // 获取套餐名
    const pkg = order.packageId && order.packageId !== 'custom' 
        ? dataManager.getPackageById(order.packageId) : null;
    const pkgName = pkg ? pkg.name : '定制套餐';

    // 获取菜品数量
    const dishCount = (order.selectedDishes || []).length;

    // 生成称呼（取姓名最后一个字 + 哥/姐）
    let name = order.customerName || '客户';
    let title = '哥';
    if (name.length > 0) {
        const lastChar = name.slice(-1);
        // 简单判断，如果是常见女性字用"姐"，否则用"哥"
        const femaleChars = ['姐', '妹', '芳', '娜', '丽', '梅', '燕', '玲', '婷', '娟', '敏', '静', '秀', '兰', '红', '艳', '霞', '云', '琴', '萍'];
        title = femaleChars.includes(lastChar) ? '姐' : '哥';
    }

    // 组装话术
    const message = `专注精品宴席，我是${APP_CONFIG.chefName}。${name}${title}您好，确认下您的订单：${dateStr}，${order.mainTables || 0}备${order.backupTables || 0}席，${pkgName}共${dishCount}道菜，每席${order.perTablePrice || 0}元，总价${order.totalPrice || 0}元。如有加桌减桌或改菜请提前联系。如有疑问请联系：${APP_CONFIG.phone}。`;

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div style="margin-bottom:8px;">${message}</div>
        <button class="btn btn-sm btn-primary" onclick="if(navigator.clipboard){navigator.clipboard.writeText(this.parentElement.querySelector('div').textContent).then(()=>{showToast('已复制到剪贴板');if(window.NativeHaptics)NativeHaptics.success();}).catch(()=>showToast('复制失败','error'));}else{showToast('浏览器不支持复制','error');}">
            <span class="material-icons" style="font-size:14px;">content_copy</span>
            复制文案
        </button>
    `;

    btn.innerHTML = '<span class="material-icons" style="font-size:18px;">refresh</span> 重新生成';
    if (window.NativeHaptics) window.NativeHaptics.success();
}

// ==================== 搜索功能 ====================

function searchDishes(keyword) {
    appState.searchKeyword = keyword;
    navigateTo('dishes');
}

function searchPackages(keyword) {
    appState.searchKeyword = keyword;
    navigateTo('packagesManage');
}

function searchCustomers(keyword) {
    appState.searchKeyword = keyword;
    navigateTo('customers');
}

function toggleCustomerDetail(idx) {
    const el = document.getElementById('customerDetail_' + idx);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
}

function clearSearch() {
    appState.searchKeyword = '';
    navigateTo(appState.currentPage);
}

/**
 * 显示菜品详情弹窗
 */
async function showDishDetail(dishId) {
    const dish = dataManager.getDishById(dishId);
    if (!dish) return;

    // 获取自定义图片
    let imgSrc = `https://picsum.photos/id/404/400/300`;
    try {
        const customImg = await ImageDB.get(dishId);
        if (customImg) imgSrc = customImg;
    } catch(e) {}

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2 class="modal-title">菜品详情</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div style="padding: 16px;">
                <img src="${imgSrc}" alt="${dish.name}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 16px;" onerror="this.src='https://picsum.photos/id/404/400/300'">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${dish.name}</span>
                    <span style="font-size: 16px; font-weight: 600; color: var(--price);">${utils.formatPrice(dish.price)}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                    <span class="category-chip">${dish.category}</span>
                </div>
                <div style="font-size: 14px; color: var(--text-primary); line-height: 1.6;">
                    ${dish.description || '暂无描述'}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function filterDishes(category, element) {
    document.querySelectorAll('.category-chip').forEach(chip => chip.classList.remove('active'));
    element.classList.add('active');

    const cards = document.querySelectorAll('.dish-card');
    cards.forEach(card => {
        if (category === '全部' || card.dataset.category === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ==================== 菜品管理 ====================

async function deleteDish(dishId) {
    const dish = dataManager.getDishById(dishId);
    if (!dish) return;

    // 检查是否有未确认订单引用此菜品
    const pendingOrders = dataManager.getOrders().filter(o => o.status === 'pending' && o.selectedDishes && o.selectedDishes.includes(dishId));
    // 检查是否有套餐引用此菜品
    const affectedPackages = dataManager.getPackages().filter(p => p.includedDishes && p.includedDishes.includes(dishId));

    let warningMsg = `确定要删除「${dish.name}」吗？`;
    if (pendingOrders.length > 0) warningMsg += `<br><br>⚠️ 有 <strong>${pendingOrders.length}</strong> 个待确认订单包含此菜品，删除后订单中将不再显示。`;
    if (affectedPackages.length > 0) warningMsg += `<br><br>⚠️ 有 <strong>${affectedPackages.length}</strong> 个套餐包含此菜品，删除后将自动从套餐中移除。`;

    const ok = await customConfirm({
        title: '删除菜品',
        message: warningMsg,
        type: 'danger',
        confirmText: '删除',
        cancelText: '取消'
    });
    if (ok) {
        // 从所有套餐中移除该菜品
        for (const pkg of affectedPackages) {
            await dataManager.updatePackage(pkg.id, {
                includedDishes: pkg.includedDishes.filter(id => id !== dishId)
            });
        }
        await dataManager.deleteDish(dishId);
        utils.showToast('菜品已删除' + (affectedPackages.length > 0 ? `，已从${affectedPackages.length}个套餐中移除` : ''));
        navigateTo('dishes');
    }
}

function editDish(dishId) {
    const dish = dataManager.getDishById(dishId);
    if (!dish) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">编辑菜品</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>

            <form onsubmit="updateDish(event, '${dishId}'); this.closest('.modal-overlay').remove();">
                <div class="form-group">
                    <label class="form-label">菜品图片</label>
                    <div class="dish-image-upload" id="editDishImageUpload">
                        <img src="https://picsum.photos/id/404/400/300" alt="预览" class="dish-image-preview" id="editDishImgPreview" style="display:none;">
                        <div class="dish-image-upload-btn" id="editDishUploadBtn">
                            <span class="material-icons">add_photo_alternate</span>
                            <span>点击上传菜品图片</span>
                        </div>
                    </div>
                    <input type="file" accept="image/*" capture="environment" id="editDishFileInput" style="display:none" onchange="if(this.files.length>0)handleDishImageUpload(this.files[0],'edit')">
                    <div style="font-size:11px;color:var(--text-light);margin-top:4px;">支持拍照或从相册选择，图片将自动压缩</div>
                </div>
                <div class="form-group">
                    <label class="form-label">菜品名称 *</label>
                    <input type="text" class="form-input" name="name" value="${dish.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">价格 *</label>
                    <input type="number" class="form-input" name="price" value="${dish.price}" required step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">分类 *</label>
                    <select class="form-select" name="category" required>
                        <option value="热菜" ${dish.category === '热菜' ? 'selected' : ''}>热菜</option>
                        <option value="凉菜" ${dish.category === '凉菜' ? 'selected' : ''}>凉菜</option>
                        <option value="汤品" ${dish.category === '汤品' ? 'selected' : ''}>汤品</option>
                        <option value="主食" ${dish.category === '主食' ? 'selected' : ''}>主食</option>
                        <option value="甜点" ${dish.category === '甜点' ? 'selected' : ''}>甜点</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">描述</label>
                    <textarea class="form-input form-textarea" name="description" placeholder="请输入菜品描述">${dish.description || ''}</textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">保存修改</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    setupDishImageUpload('edit');
    // 异步加载已有自定义图片
    ImageDB.get(dishId).then(base64 => {
        if (base64) {
            const preview = document.getElementById('editDishImgPreview');
            const btn = document.getElementById('editDishUploadBtn');
            if (preview) { preview.src = base64; preview.style.display = 'block'; }
            if (btn) btn.innerHTML = '<span class="material-icons">refresh</span><span>重新上传</span>';
        }
    }).catch(() => {});
}

async function updateDish(event, dishId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    // 从IndexedDB获取临时图片并绑定到dishId
    try {
        const base64 = await ImageDB.get('edit_temp');
        if (base64) {
            await ImageDB.save(dishId, base64);
            await ImageDB.delete('edit_temp');
        }
    } catch(e) {}

    await dataManager.updateDish(dishId, {
        name: formData.get('name'),
        price: parseFloat(formData.get('price')),
        category: formData.get('category'),
        description: formData.get('description'),
        hasCustomImage: true
    });

    utils.showToast('菜品更新成功');
    if (window.NativeHaptics) NativeHaptics.light();
    navigateTo('dishes');
}

function showAddDishModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">添加菜品</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>

            <form onsubmit="addDish(event); this.closest('.modal-overlay').remove();">
                <div class="form-group">
                    <label class="form-label">菜品图片</label>
                    <div class="dish-image-upload" id="addDishImageUpload">
                        <img src="https://picsum.photos/id/404/400/300" alt="预览" class="dish-image-preview" id="addDishImgPreview" style="display:none;">
                        <div class="dish-image-upload-btn" id="addDishUploadBtn">
                            <span class="material-icons">add_photo_alternate</span>
                            <span>点击上传菜品图片</span>
                        </div>
                    </div>
                    <input type="file" accept="image/*" capture="environment" id="addDishFileInput" style="display:none" onchange="if(this.files.length>0)handleDishImageUpload(this.files[0],'add')">
                    <div style="font-size:11px;color:var(--text-light);margin-top:4px;">支持拍照或从相册选择，图片将自动压缩</div>
                </div>
                <div class="form-group">
                    <label class="form-label">菜品名称 *</label>
                    <input type="text" class="form-input" name="name" required>
                </div>
                <div class="form-group">
                    <label class="form-label">价格 *</label>
                    <input type="number" class="form-input" name="price" required step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">分类 *</label>
                    <select class="form-select" name="category" required>
                        <option value="热菜">热菜</option>
                        <option value="凉菜">凉菜</option>
                        <option value="汤品">汤品</option>
                        <option value="主食">主食</option>
                        <option value="甜点">甜点</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">描述</label>
                    <textarea class="form-input form-textarea" name="description" placeholder="请输入菜品描述"></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">添加</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    setupDishImageUpload('add');
}

async function addDish(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const dish = {
        id: utils.generateId('dish'),
        name: formData.get('name'),
        price: parseFloat(formData.get('price')),
        category: formData.get('category'),
        description: formData.get('description'),
        hasCustomImage: true,
        isAvailable: true
    };

    // 从IndexedDB获取临时图片并绑定到dishId
    try {
        const base64 = await ImageDB.get('add_temp');
        if (base64) {
            await ImageDB.save(dish.id, base64);
            await ImageDB.delete('add_temp');
        }
    } catch(e) {}

    await dataManager.addDish(dish);
    utils.showToast('菜品添加成功');
    if (window.NativeHaptics) NativeHaptics.light();
    navigateTo('dishes');
}

// ==================== 套餐管理 ====================

async function deletePackage(packageId) {
    const pkg = dataManager.getPackageById(packageId);
    const ok = await customConfirm({
        title: '删除套餐',
        message: `确定要删除「${pkg ? pkg.name : ''}」吗？此操作不可恢复。`,
        type: 'danger',
        confirmText: '删除',
        cancelText: '取消'
    });
    if (ok) {
        await dataManager.deletePackage(packageId);
        utils.showToast('套餐已删除');
        navigateTo('packagesManage');
    }
}

function editPackage(packageId) {
    const pkg = dataManager.getPackageById(packageId);
    if (!pkg) return;

    const allDishes = dataManager.getDishes();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">编辑套餐</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>

            <form onsubmit="updatePackage(event, '${packageId}'); this.closest('.modal-overlay').remove();">
                <div class="form-group">
                    <label class="form-label">套餐名称 *</label>
                    <input type="text" class="form-input" name="name" value="${pkg.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">原价 *</label>
                    <input type="number" class="form-input" name="originalPrice" value="${pkg.originalPrice}" required step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">现价 *</label>
                    <input type="number" class="form-input" name="currentPrice" value="${pkg.currentPrice}" required step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">每席人数</label>
                    <input type="number" class="form-input" name="suitableFor" value="${pkg.suitableFor || ''}" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">描述</label>
                    <textarea class="form-input form-textarea" name="description" placeholder="请输入套餐描述">${pkg.description}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">选择包含菜品</label>
                    <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-input); padding: 8px;">
                        ${['热菜','凉菜','汤品','主食','甜点'].map(cat => {
                            const catDishes = allDishes.filter(d => d.category === cat);
                            if (catDishes.length === 0) return '';
                            return `<div style="font-size:12px;color:var(--text-light);padding:6px 8px 2px;font-weight:600;">${cat}</div>` +
                                catDishes.map(dish => `
                                    <label style="display: flex; align-items: center; padding: 6px 8px; cursor: pointer; border-radius: 4px;">
                                        <input type="checkbox" name="dishes" value="${dish.id}" ${pkg.includedDishes && pkg.includedDishes.includes(dish.id) ? 'checked' : ''} style="margin-right: 8px;">
                                        <span style="flex:1;">${dish.name}</span>
                                        <span style="font-size:12px;color:var(--price);">${utils.formatPrice(dish.price)}</span>
                                    </label>
                                `).join('');
                        }).join('')}
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block">保存修改</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function updatePackage(event, packageId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const selectedDishes = Array.from(form.querySelectorAll('input[name="dishes"]:checked')).map(cb => cb.value);

    await dataManager.updatePackage(packageId, {
        name: formData.get('name'),
        originalPrice: parseFloat(formData.get('originalPrice')),
        currentPrice: parseFloat(formData.get('currentPrice')),
        suitableFor: formData.get('suitableFor') ? parseInt(formData.get('suitableFor')) : null,
        description: formData.get('description'),
        includedDishes: selectedDishes
    });

    utils.showToast('套餐更新成功');
    navigateTo('packagesManage');
}

function showAddPackageModal() {
    const allDishes = dataManager.getDishes();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">添加套餐</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>

            <form onsubmit="addPackage(event); this.closest('.modal-overlay').remove();">
                <div class="form-group">
                    <label class="form-label">套餐名称 *</label>
                    <input type="text" class="form-input" name="name" required>
                </div>
                <div class="form-group">
                    <label class="form-label">原价 *</label>
                    <input type="number" class="form-input" name="originalPrice" required step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">现价 *</label>
                    <input type="number" class="form-input" name="currentPrice" required step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">每席人数</label>
                    <input type="number" class="form-input" name="suitableFor" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">描述</label>
                    <textarea class="form-input form-textarea" name="description" placeholder="请输入套餐描述"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">选择包含菜品</label>
                    <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-input); padding: 8px;">
                        ${['热菜','凉菜','汤品','主食','甜点'].map(cat => {
                            const catDishes = allDishes.filter(d => d.category === cat);
                            if (catDishes.length === 0) return '';
                            return `<div style="font-size:12px;color:var(--text-light);padding:6px 8px 2px;font-weight:600;">${cat}</div>` +
                                catDishes.map(dish => `
                                    <label style="display: flex; align-items: center; padding: 6px 8px; cursor: pointer; border-radius: 4px;">
                                        <input type="checkbox" name="dishes" value="${dish.id}" style="margin-right: 8px;">
                                        <span style="flex:1;">${dish.name}</span>
                                        <span style="font-size:12px;color:var(--price);">${utils.formatPrice(dish.price)}</span>
                                    </label>
                                `).join('');
                        }).join('')}
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block">添加套餐</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function addPackage(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const selectedDishes = Array.from(form.querySelectorAll('input[name="dishes"]:checked')).map(cb => cb.value);

    if (selectedDishes.length === 0) {
        utils.showToast('请至少选择一个菜品', 'warning');
        return;
    }

    const pkg = {
        id: utils.generateId('pkg'),
        name: formData.get('name'),
        originalPrice: parseFloat(formData.get('originalPrice')),
        currentPrice: parseFloat(formData.get('currentPrice')),
        suitableFor: formData.get('suitableFor') ? parseInt(formData.get('suitableFor')) : null,
        description: formData.get('description') || '暂无描述',
        includedDishes: selectedDishes,
        isAvailable: true
    };

    await dataManager.addPackage(pkg);
    utils.showToast('套餐添加成功');
    navigateTo('packagesManage');
}

// ==================== 日历功能 ====================

function changeMonth(delta) {
    const newMonth = new Date(appState.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    appState.currentMonth = newMonth;
    navigateTo('schedule');
}

function resetToToday() {
    appState.currentMonth = new Date();
    appState.selectedDate = new Date();
    navigateTo('schedule');
}

function selectDate(dateString) {
    appState.selectedDate = new Date(dateString);
    // 局部更新：只更新日历高亮和订单列表，不刷新整个页面
    updateScheduleUI();
}

function clearDateFilter() {
    appState.selectedDate = null;
    updateScheduleUI();
}

// 局部更新排程页面（日历高亮+订单列表）
function updateScheduleUI() {
    // 更新日历高亮
    document.querySelectorAll('.calendar-day').forEach(el => {
        el.classList.remove('selected');
    });
    if (appState.selectedDate) {
        const day = appState.selectedDate.getDate();
        const target = document.querySelector(`.calendar-day[data-day="${day}"]`);
        if (target) target.classList.add('selected');
    }

    // 更新标题
    const titleEl = document.querySelector('.card-header .card-title');
    if (titleEl) {
        titleEl.textContent = appState.selectedDate ? utils.formatDateShort(appState.selectedDate) : '本月';
        titleEl.textContent += '订单';
    }

    // 更新订单列表
    const ordersContainer = document.querySelector('.schedule-orders');
    if (ordersContainer) {
        ordersContainer.innerHTML = pages.renderScheduleOrders();
    }
}

// ==================== 订单详情 ====================

function showOrderDetail(orderId) {
    const order = dataManager.getOrderById(orderId);
    if (!order) return;
    const pkg = dataManager.getPackageById(order.packageId);
    const statusText = { pending: '待确认', confirmed: '已确认', cancelled: '已取消' }[order.status];

    // 获取订单中的菜品信息
    const orderDishes = (order.selectedDishes || (pkg ? pkg.includedDishes : []) || []).map(id => dataManager.getDishById(id)).filter(Boolean);
    const coldDishes = orderDishes.filter(d => d.category === '凉菜');
    const hotDishes = orderDishes.filter(d => d.category === '热菜');
    const soupDishes = orderDishes.filter(d => d.category === '汤品');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">订单详情</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>

            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">订单号</span>
                    <span>${order.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">客户姓名</span>
                    <span>${order.customerName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">联系电话</span>
                    <span>${order.phone}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">宴席日期</span>
                    <span>${utils.formatDate(order.date)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">席数</span>
                    <span>${order.mainTables || order.tableCount || '-'}备${order.backupTables || '0'}（共${order.totalTables || (order.mainTables + order.backupTables) || order.tableCount || '-'}席）</span>
                </div>
                ${order.perTablePrice ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">每席价格</span>
                    <span>${utils.formatPrice(order.perTablePrice)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">订单金额</span>
                    <span style="color: var(--price); font-weight: 700;">${utils.formatPrice(order.totalPrice)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">订单状态</span>
                    <span class="order-status ${order.status}">${statusText}</span>
                </div>
                ${order.notes ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: var(--text-secondary);">备注</span>
                    <span>${order.notes}</span>
                </div>` : ''}
            </div>

            ${orderDishes.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 10px;">菜品清单（${orderDishes.length}道）</h4>
                    ${coldDishes.length > 0 ? `
                        <div style="margin-bottom: 10px;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">凉菜（${coldDishes.length}道）</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${coldDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${hotDishes.length > 0 ? `
                        <div style="margin-bottom: 10px;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">热菜（${hotDishes.length}道）</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${hotDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${soupDishes.length > 0 ? `
                        <div style="margin-bottom: 10px;">
                            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px;">汤品（${soupDishes.length}道）</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${soupDishes.map(d => `<span class="category-chip">${d.name} ${utils.formatPrice(d.price)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px;">
                ${order.status === 'pending' ? `
                    <button class="btn btn-primary" style="grid-column: span 2;" onclick="updateOrderStatus('${order.id}', 'confirmed'); this.closest('.modal-overlay').remove();">确认订单</button>
                    <button class="btn btn-secondary" onclick="editOrder('${order.id}'); this.closest('.modal-overlay').remove();">编辑</button>
                    <button class="btn btn-secondary" onclick="updateOrderStatus('${order.id}', 'cancelled'); this.closest('.modal-overlay').remove();">取消</button>
                ` : ''}
                ${order.status === 'confirmed' ? `
                    <button class="btn btn-secondary" onclick="editOrder('${order.id}'); this.closest('.modal-overlay').remove();">编辑</button>
                    <button class="btn btn-secondary" onclick="updateOrderStatus('${order.id}', 'pending'); this.closest('.modal-overlay').remove();">取消确认</button>
                ` : ''}
                <button class="btn btn-secondary" onclick="showMenuCard('${order.id}')">菜单卡片</button>
                <button class="btn btn-secondary" onclick="showPrepList('${order.id}')">备菜清单</button>
                <button class="btn btn-danger" style="grid-column: span 2;" onclick="deleteOrder('${order.id}'); this.closest('.modal-overlay').remove();">删除订单</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

async function updateOrderStatus(orderId, status) {
    await dataManager.updateOrder(orderId, { status });
    utils.showToast(status === 'confirmed' ? '订单已确认' : '订单已取消');
    navigateTo(appState.currentPage);
}

// 备菜清单弹窗
function showPrepList(orderId) {
    const order = dataManager.getOrderById(orderId);
    if (!order) return;
    const pkg = dataManager.getPackageById(order.packageId);

    const orderDishes = (order.selectedDishes || (pkg ? pkg.includedDishes : []) || [])
        .map(id => dataManager.getDishById(id)).filter(Boolean);

    const totalTables = (order.mainTables || 0) + (order.backupTables || 0) || order.totalTables || order.tableCount || 1;

    // 按分类整理菜品
    const coldDishes = orderDishes.filter(d => d.category === '凉菜');
    const hotDishes = orderDishes.filter(d => d.category === '热菜');
    const soupDishes = orderDishes.filter(d => d.category === '汤品');
    const otherDishes = orderDishes.filter(d => !['凉菜','热菜','汤品'].includes(d.category));

    // 格式化日期
    let dateStr = utils.formatDate(order.date);
    try {
        const d = new Date(order.date);
        const weekDays = ['日','一','二','三','四','五','六'];
        dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    } catch(e) {}

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">备菜清单</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div id="prepListContent" style="padding: 16px;">
                <div style="border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 16px;">
                    <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">客户：${order.customerName || '未知'}</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">日期：${dateStr} · ${totalTables}席 · ${orderDishes.length}道菜</div>
                </div>

                <!-- 天气预报 -->
                <div id="weatherInfo" style="margin-bottom: 16px; padding: 12px; background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%); border-radius: 8px; color: #333;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons" style="font-size: 20px;">wb_cloudy</span>
                        <span style="font-weight: 600;">天气预报</span>
                    </div>
                    <div id="weatherText" style="margin-top: 8px; font-size: 13px;">正在获取天气信息...</div>
                </div>

                ${coldDishes.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">凉菜 (${coldDishes.length}道)</div>
                    <div style="background: var(--surface); border-radius: 8px; padding: 12px;">
                        ${coldDishes.map(d => `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span>${d.name}</span><span style="color: var(--text-light);">${totalTables}席 × 1份</span></div>`).join('')}
                    </div>
                </div>` : ''}

                ${hotDishes.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">热菜 (${hotDishes.length}道)</div>
                    <div style="background: var(--surface); border-radius: 8px; padding: 12px;">
                        ${hotDishes.map(d => `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span>${d.name}</span><span style="color: var(--text-light);">${totalTables}席 × 1份</span></div>`).join('')}
                    </div>
                </div>` : ''}

                ${soupDishes.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">汤品 (${soupDishes.length}道)</div>
                    <div style="background: var(--surface); border-radius: 8px; padding: 12px;">
                        ${soupDishes.map(d => `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span>${d.name}</span><span style="color: var(--text-light);">${totalTables}席 × 1份</span></div>`).join('')}
                    </div>
                </div>` : ''}

                ${otherDishes.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">其他 (${otherDishes.length}道)</div>
                    <div style="background: var(--surface); border-radius: 8px; padding: 12px;">
                        ${otherDishes.map(d => `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border);"><span>${d.name}</span><span style="color: var(--text-light);">${totalTables}席 × 1份</span></div>`).join('')}
                    </div>
                </div>` : ''}

                <div style="margin-top: 16px; padding: 12px; background: rgba(196,92,72,0.1); border-radius: 8px; font-size: 13px; color: var(--text-secondary);">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">备菜提示</div>
                    <div>• 每席按10人计算，共需准备 ${totalTables * 10} 人份食材</div>
                    <div>• 建议多备10%食材以防不足</div>
                    <div>• 提前一天采购，当天备菜</div>
                </div>

                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button class="btn btn-primary" style="flex: 1;" onclick="window.print()">
                        <span class="material-icons" style="font-size: 18px;">print</span>
                        打印清单
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // 获取天气预报
    fetchWeather(order.date, order.address);
}

// 获取天气预报
async function fetchWeather(date, address) {
    const weatherText = document.getElementById('weatherText');
    if (!weatherText) return;

    try {
        // 计算日期差
        const targetDate = new Date(date);
        const today = new Date();
        const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            weatherText.textContent = '该日期已过，无法获取天气';
            return;
        }

        if (diffDays > 7) {
            weatherText.textContent = `${date}（距今${diffDays}天，天气预报仅支持7天内）`;
            return;
        }

        // 使用 wttr.in 获取天气（免费，无需 API Key）
        const location = address ? encodeURIComponent(address.split('市')[0] || address.split('县')[0] || '西安') : '西安';
        const response = await fetch(`https://wttr.in/${location}?format=j1`);
        const data = await response.json();

        // 获取对应日期的天气
        const weatherData = diffDays === 0 ? data.current_condition[0] : data.weather[diffDays];
        const temp = weatherData.avgtempC || weatherData.tempC;
        const weatherDesc = weatherData.weatherDesc ? weatherData.weatherDesc[0].value : '未知';
        const humidity = weatherData.humidity || '-';

        // 天气建议
        let suggestion = '';
        if (temp > 30) suggestion = '高温天气，建议多备清凉菜品';
        else if (temp < 10) suggestion = '低温天气，建议多备热菜热汤';
        else if (weatherDesc.includes('雨')) suggestion = '雨天，建议备防雨措施，菜品可适当增加热汤';
        else suggestion = '天气适宜，正常备菜';

        weatherText.innerHTML = `
            <div>${date} · ${weatherDesc} · ${temp}℃ · 湿度${humidity}%</div>
            <div style="margin-top: 4px; color: #8B4513;">💡 ${suggestion}</div>
        `;
    } catch(e) {
        weatherText.textContent = `天气获取失败，请手动查询 ${date} 天气`;
    }
}

function editOrder(orderId) {
    const order = dataManager.getOrderById(orderId);
    if (!order) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">编辑订单</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>

            <div class="form-group">
                <label class="form-label">主席数</label>
                <input type="number" class="form-input" id="editMainTables" min="1" value="${order.mainTables || order.tableCount || ''}">
            </div>

            <div class="form-group">
                <label class="form-label">备席数</label>
                <input type="number" class="form-input" id="editBackupTables" min="0" value="${order.backupTables || 0}">
            </div>

            <div class="form-group">
                <label class="form-label">订单状态</label>
                <select class="form-input" id="editStatus">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>待确认</option>
                    <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>已确认</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>已取消</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-input" id="editNotes" rows="3">${order.notes || ''}</textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button class="btn btn-secondary" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">取消</button>
                <button class="btn btn-primary" style="flex: 1;" id="editOrderSaveBtn">保存</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#editOrderSaveBtn').addEventListener('click', async () => {
        const mainTables = parseInt(modal.querySelector('#editMainTables').value) || 0;
        const backupTables = parseInt(modal.querySelector('#editBackupTables').value) || 0;
        const status = modal.querySelector('#editStatus').value;
        const notes = modal.querySelector('#editNotes').value.trim();

        if (mainTables < 1) {
            customAlert({ title: '提示', message: '主席数至少为1', type: 'warning' });
            return;
        }

        const updates = {
            mainTables,
            backupTables,
            totalTables: mainTables + backupTables,
            status,
            notes
        };

        if (order.perTablePrice) {
            updates.totalPrice = order.perTablePrice * mainTables;
        }

        await dataManager.updateOrder(orderId, updates);

        if (window.NativeHaptics) NativeHaptics.light();
        utils.showToast('订单已更新');

        modal.remove();
        navigateTo(appState.currentPage);
    });
}

/**
 * 下载订单详情为图片
 */
async function downloadOrderDetailImage(orderId) {
    const captureEl = document.getElementById('orderDetailCapture');
    if (!captureEl) return;

    showToast('正在生成图片...');

    try {
        const canvas = await html2canvas(captureEl, {
            scale: 2,
            backgroundColor: '#FFFFFF',
            useCORS: true
        });

        const link = document.createElement('a');
        link.download = '订单详情_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('图片已保存');
        if (window.NativeHaptics) window.NativeHaptics.success();
    } catch(e) {
        showToast('生成图片失败: ' + e.message);
    }
}

/**
 * 生成电子菜单卡片
 */
function showMenuCard(orderId) {
    const order = dataManager.getOrderById(orderId);
    if (!order) return;
    const pkg = dataManager.getPackageById(order.packageId);

    const orderDishes = (order.selectedDishes || (pkg ? pkg.includedDishes : []) || [])
        .map(id => dataManager.getDishById(id)).filter(Boolean);
    const coldDishes = orderDishes.filter(d => d.category === '凉菜');
    const hotDishes = orderDishes.filter(d => d.category === '热菜');
    const soupDishes = orderDishes.filter(d => d.category === '汤品');
    const otherDishes = orderDishes.filter(d => !['凉菜','热菜','汤品'].includes(d.category));

    const totalTables = (order.mainTables || 0) + (order.backupTables || 0) || order.totalTables || order.tableCount || 1;

    // 格式化日期
    let dateStr = utils.formatDate(order.date);
    try {
        const d = new Date(order.date);
        dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    } catch(e) {}

    // 渲染菜品列表
    function renderDishList(dishes, maxCount) {
        const items = dishes.slice(0, maxCount);
        if (items.length === 0) return '<div style="color:#E8C88A;opacity:0.5;font-size:15px;text-align:center;padding:8px 0;">—</div>';
        return items.map(d => `<div style="font-size:16px;font-weight:600;color:#F0D48A;padding:5px 0;text-align:center;letter-spacing:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.name}</div>`).join('');
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">菜单卡片</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>

            <!-- 卡片预览区域 - 纯CSS实现 -->
            <div id="menuCardCapture" style="
                width: 360px;
                min-height: 600px;
                margin: 0 auto;
                position: relative;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(139,26,26,0.3);
                background: linear-gradient(180deg, #8B1A1A 0%, #6B1010 100%);
            ">
                <!-- 顶部装饰边框 -->
                <div style="
                    position: absolute;
                    top: 12px; left: 12px; right: 12px; bottom: 12px;
                    border: 2px solid rgba(240,212,138,0.5);
                    border-radius: 12px;
                    pointer-events: none;
                "></div>

                <!-- Logo区域 -->
                <div style="text-align: center; padding: 24px 0 8px;">
                    <img src="./assets/logo.png" alt="斌选" style="width: 100px; height: 100px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                </div>

                <!-- 宴席信息 -->
                <div style="text-align: center; padding: 0 20px 16px;">
                    <div style="font-size: 14px; color: #F0D48A; font-weight: 600; letter-spacing: 2px;">${order.customerName || '客户'} · ${dateStr}</div>
                    <div style="font-size: 17px; color: #FFF; font-weight: 700; margin-top: 4px; letter-spacing: 1px;">${totalTables} 席宴席</div>
                </div>

                <!-- 菜品区域 -->
                <div style="padding: 0 24px 20px;">
                    <!-- 凉菜 -->
                    <div style="margin-bottom: 16px;">
                        <div style="text-align: center; margin-bottom: 8px;">
                            <span style="font-size: 13px; color: #F0D48A; font-weight: 700; letter-spacing: 4px;">—— 凉 菜 ——</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; border: 1px solid rgba(240,212,138,0.2);">
                            ${renderDishList(coldDishes, 8)}
                        </div>
                    </div>

                    <!-- 热菜 -->
                    <div style="margin-bottom: 16px;">
                        <div style="text-align: center; margin-bottom: 8px;">
                            <span style="font-size: 13px; color: #F0D48A; font-weight: 700; letter-spacing: 4px;">—— 热 菜 ——</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; border: 1px solid rgba(240,212,138,0.2);">
                            ${renderDishList(hotDishes, 12)}
                        </div>
                    </div>

                    <!-- 汤品 -->
                    <div style="margin-bottom: 16px;">
                        <div style="text-align: center; margin-bottom: 8px;">
                            <span style="font-size: 13px; color: #F0D48A; font-weight: 700; letter-spacing: 4px;">—— 汤 品 ——</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; border: 1px solid rgba(240,212,138,0.2);">
                            ${renderDishList([...soupDishes, ...otherDishes], 4)}
                        </div>
                    </div>
                </div>

                <!-- 底部信息 -->
                <div style="text-align: center; padding: 0 20px 24px;">
                    <div style="width: 60px; height: 1px; background: rgba(240,212,138,0.5); margin: 0 auto 12px;"></div>
                    <div style="font-size: 13px; color: #F0D48A; font-weight: 600; letter-spacing: 1px;">厨师：${APP_CONFIG.chefName}</div>
                    <div style="font-size: 16px; color: #FFF; font-weight: 700; margin-top: 6px; letter-spacing: 2px;">${APP_CONFIG.phone}</div>
                    <div style="font-size: 12px; color: #F0D48A; font-weight: 600; opacity: 0.8; margin-top: 8px; letter-spacing: 1px;">${APP_CONFIG.slogan}</div>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button type="button" class="btn btn-primary" style="flex:1;" onclick="downloadMenuCardImage()">
                    <span class="material-icons" style="font-size:18px;">download</span>
                    下载卡片
                </button>
                <button type="button" class="btn btn-secondary" style="flex:1;" onclick="shareMenuCard()">
                    <span class="material-icons" style="font-size:18px;">share</span>
                    分享
                </button>
            </div>
            <div style="font-size:12px;color:var(--text-light);text-align:center;margin-top:8px;">下载后可发送给客户，客户保存图片即可查看和转发</div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * 下载菜单卡片为图片
 */
async function downloadMenuCardImage() {
    const captureEl = document.getElementById('menuCardCapture');
    if (!captureEl) return;

    showToast('正在生成卡片图片...');

    try {
        const canvas = await html2canvas(captureEl, {
            scale: 2,
            backgroundColor: null,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        const link = document.createElement('a');
        link.download = '菜单卡片_' + (window._currentOrder?.customerName || '') + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('卡片已保存，可发送给客户');
        if (window.NativeHaptics) window.NativeHaptics.success();
    } catch(e) {
        showToast('生成失败: ' + e.message);
    }
}

/**
 * 分享菜单卡片
 */
async function shareMenuCard() {
    const captureEl = document.getElementById('menuCardCapture');
    if (!captureEl) return;

    showToast('正在生成分享图片...');

    try {
        const canvas = await html2canvas(captureEl, {
            scale: 2,
            backgroundColor: null,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        // 转为 blob
        canvas.toBlob(async (blob) => {
            if (!blob) {
                showToast('生成失败');
                return;
            }

            const file = new File([blob], '菜单卡片.png', { type: 'image/png' });

            // 尝试使用 Web Share API（手机上可用）
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: `${APP_CONFIG.brandName} · 宴席菜单`,
                        text: `${APP_CONFIG.chefName}师傅的宴席菜单`,
                        files: [file]
                    });
                    showToast('分享成功');
                    return;
                } catch(e) {
                    if (e.name === 'AbortError') return;
                }
            }

            // 降级：下载图片
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = '菜单卡片.png';
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            showToast('已保存图片，请手动分享');
        }, 'image/png');
    } catch(e) {
        showToast('分享失败: ' + e.message);
    }
}

async function deleteOrder(orderId) {
    const ok = await customConfirm({
        title: '删除订单',
        message: '确定要删除这个订单吗？此操作不可恢复。',
        type: 'danger',
        confirmText: '删除',
        cancelText: '取消'
    });
    if (ok) {
        await dataManager.deleteOrder(orderId);
        utils.showToast('订单已删除');
        navigateTo(appState.currentPage);
    }
}

/**
 * 保存 AI API Key
 */
function saveAiApiKey() {
    const input = document.getElementById('aiApiKeyInput');
    if (input) {
        localStorage.setItem('ai_api_key', input.value.trim());
        AIService.API_KEY = input.value.trim();
        showToast('API Key 已保存');
        if (window.NativeHaptics) window.NativeHaptics.success();
    }
}

// ==================== 初始化 ====================

// 等待 dataManager 初始化完成（支持 Capacitor Native 存储）
function initApp() {
    navigateTo('dashboard');
    initDishImages();
}

document.addEventListener('DOMContentLoaded', () => {
    // 检查 dataManager 是否已初始化
    if (dataManager.initialized) {
        initApp();
    } else {
        // 等待初始化完成事件
        window.addEventListener('dataManagerReady', initApp, { once: true });
        // 超时保护（3秒后强制初始化）
        setTimeout(() => {
            if (!dataManager.initialized) {
                console.warn('dataManager 初始化超时，使用默认数据');
                initApp();
            }
        }, 3000);
    }
});
