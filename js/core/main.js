// グローバル変数
let scene, camera, renderer;
let agents = [];
let locations = [];
let apiKey = '';
let simulationRunning = false;
let simulationPaused = false;
let timeSpeed = 1;
let currentTime = 8 * 60; // 8:00 AM in minutes
const clock = new THREE.Clock();

// カメラシステム
let cameraSystem = null;

// フィールド色設定
let fieldColor = 0x2d2d2d; // デフォルトはブラック
let groundMesh = null;
let infiniteGroundMesh = null;

// 天候システム（weather.jsで定義されるため、ここでは宣言のみ）

// グローバル変数をwindowに公開
window.agents = agents;

// LLMへの問い合わせ回数を管理
let llmCallCount = 0;

// コミュニケーション機能の変数（新しい管理システムで置き換え）

// 時間制御用の変数
let lastTimeUpdate = 0;
let timeUpdateInterval = timeConfig.timeUpdateInterval / 1000; // configから読み込み（秒単位に変換）

// localStorageからAPIキーを読み込み
function loadApiKeyFromStorage() {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
        apiKey = savedApiKey;
    }
}

// APIキーをlocalStorageに保存
function saveApiKeyToStorage(key) {
    localStorage.setItem('openai_api_key', key);
}

// localStorageからプロンプトを読み込み
function loadPromptFromStorage() {
    const savedPrompt = localStorage.getItem('topic_prompt');
    if (savedPrompt) {
        document.getElementById('topicPrompt').value = savedPrompt;
    }
}

// プロンプトをlocalStorageに保存
function savePromptToStorage(prompt) {
    localStorage.setItem('topic_prompt', prompt);
}

// LLMへの問い合わせ回数を更新
function updateLlmCallCount() {
    llmCallCount++;
    const countDisplay = document.getElementById('llmCallCount');
    if (countDisplay) {
        countDisplay.textContent = llmCallCount;
    }
}

// LLMへの問い合わせ回数を表示する要素を更新
function updateLlmCallCountDisplay() {
    const countDisplay = document.getElementById('llmCallCount');
    if (countDisplay) {
        countDisplay.textContent = llmCallCount;
    }
}

// フィールド色に合わせて道路色を更新する関数
function updateRoadColorsByField(fieldColorHex) {
    // フィールド色からプリセット名を特定
    let fieldPreset = 'gray'; // デフォルト
    for (const [presetName, preset] of Object.entries(fieldColorPresets)) {
        if (preset.color === fieldColorHex) {
            fieldPreset = presetName;
            break;
        }
    }
    
    // 対応する道路色を取得
    const roadColor = roadColorByField[fieldPreset] || 0x444444;
    
    console.log(`フィールド色変更: ${fieldPreset} → 道路色: ${roadColor.toString(16)}`);
    
    // 既存の道路の色を更新
    updateExistingRoadColors(roadColor);
    
    // 建物色も更新
    updateBuildingColorsByField(fieldPreset);
}

// フィールド色に合わせて建物色を更新する関数
function updateBuildingColorsByField(fieldPreset) {
    const buildingColors = buildingColorByField[fieldPreset];
    if (!buildingColors) {
        console.log(`フィールドプリセット "${fieldPreset}" の建物色設定が見つかりません`);
        return;
    }
    
    console.log(`建物色を更新: ${fieldPreset} フィールド`);
    
    // locationDataの色を更新
    locationData.forEach(location => {
        const buildingType = getBuildingTypeFromName(location.name);
        if (buildingType && buildingColors[buildingType]) {
            location.color = buildingColors[buildingType];
            console.log(`${location.name}の色を更新: ${buildingColors[buildingType].toString(16)}`);
        }
    });
    
    // 既存の建物の色を更新
    updateExistingBuildingColors(buildingColors);
}

// 建物名から建物タイプを取得する関数
function getBuildingTypeFromName(buildingName) {
    const nameToType = {
        'カフェ': 'cafe',
        '公園': 'park',
        '図書館': 'library',
        'スポーツジム': 'gym',
        '町の広場': 'plaza',
        '学校': 'school',
        '病院': 'hospital',
        'スーパーマーケット': 'supermarket',
        'ファミレス': 'familyRestaurant',
        '郵便局': 'postOffice',
        '銀行': 'bank',
        '美容院': 'beautySalon',
        'クリーニング店': 'cleaning',
        '薬局': 'pharmacy',
        '本屋': 'bookstore',
        'コンビニ': 'convenience'
    };
    
    return nameToType[buildingName] || null;
}

// 既存の建物の色を更新する関数
function updateExistingBuildingColors(buildingColors) {
    // シーン内の全ての建物メッシュを更新
    scene.children.forEach(child => {
        if (child.material && child.material.color) {
            const currentColor = child.material.color.getHex();
            
            // 建物メッシュかどうかを判定（建物の色の範囲をチェック）
            if (isBuildingMesh(child)) {
                // 建物タイプを特定して色を更新
                const buildingType = identifyBuildingType(child);
                if (buildingType && buildingColors[buildingType]) {
                    child.material.color.setHex(buildingColors[buildingType]);
                    //console.log(`建物の色を更新: ${currentColor.toString(16)} → ${buildingColors[buildingType].toString(16)}`);
                }
            }
        }
    });
}

// メッシュが建物かどうかを判定する関数
function isBuildingMesh(mesh) {
    // 建物の特徴的な色やプロパティで判定
    if (mesh.material && mesh.material.color) {
        const color = mesh.material.color.getHex();
        // 建物で使用される色の範囲をチェック
        const buildingColors = [
            0x8B4513, 0x228B22, 0x4682B4, 0xFF6347, 0x90EE90, 0x87CEEB, 0xFFFFFF, 0xFFD700,
            0xFF69B4, 0x4169E1, 0x32CD32, 0xFF1493, 0x20B2AA, 0x00CED1, 0xFF4500,
            0x9370DB, 0x8A2BE2, 0x9932CC, 0xDA70D6, 0xDDA0DD, 0xBA55D3, 0xE6E6FA, 0xFF00FF,
            0xEE82EE, 0x8B008B, 0x9400D3, 0x696969, 0x808080, 0x2F4F4F, 0x708090, 0x778899,
            0xB0C4DE, 0xF5F5F5, 0xD3D3D3, 0xC0C0C0, 0x556B2F, 0xDC143C, 0x00CED1, 0xFF4500,
            0x4169E1, 0x1E90FF, 0x00BFFF, 0x0000CD, 0x191970, 0x000080, 0x0066CC, 0x483D8B,
            0x6495ED, 0xD2691E, 0xFFA500, 0xFF8C00, 0xFF6347, 0xCD853F, 0xDAA520, 0xFF7F50,
            0xFFB6C1, 0x98FB98, 0xE6E6FA, 0xFFC0CB, 0xDDA0DD, 0xFFF0F5, 0xDB7093, 0xC71585,
            0xBC8F8F
        ];
        
        return buildingColors.includes(color);
    }
    return false;
}

// 建物タイプを特定する関数
function identifyBuildingType(mesh) {
    // 位置や色から建物タイプを推測
    // 実際の実装では、より詳細な判定ロジックが必要
    const color = mesh.material.color.getHex();
    
    // 色から建物タイプを推測
    const colorToType = {
        0x8B4513: 'cafe',      // 茶色 → カフェ
        0x228B22: 'park',      // 緑 → 公園
        0x4682B4: 'library',   // 青 → 図書館
        0xFF6347: 'gym',       // 赤 → スポーツジム
        0x90EE90: 'plaza',     // 薄緑 → 町の広場
        0x87CEEB: 'school',    // 空色 → 学校
        0xFFFFFF: 'hospital',  // 白 → 病院
        0xFFD700: 'supermarket', // 金色 → スーパーマーケット
        0xFF69B4: 'familyRestaurant', // ピンク → ファミレス
        0x4169E1: 'postOffice', // ロイヤルブルー → 郵便局
        0x32CD32: 'bank',      // ライムグリーン → 銀行
        0xFF1493: 'beautySalon', // ディープピンク → 美容院
        0x20B2AA: 'cleaning',  // ライトシーグリーン → クリーニング店
        0x00CED1: 'pharmacy',  // ダークターコイズ → 薬局
        0xFF4500: 'convenience' // オレンジレッド → コンビニ
    };
    
    return colorToType[color] || null;
}

// フィールド色のプリセット
const fieldColorPresets = {
    green: { name: 'グリーン', color: 0xB8E6B8 },
    purple: { name: 'パープル', color: 0x8B5A8B }, // より濃い紫に変更
    black: { name: 'ブラック', color: 0x2d2d2d },
    blue: { name: 'ブルー', color: 0xB8E6F0 },
    orange: { name: 'オレンジ', color: 0xF0E6B8 },
    pink: { name: 'ピンク', color: 0xF0B8E6 },
    gray: { name: 'グレー', color: 0xC0C0C0 },
    brown: { name: 'ブラウン', color: 0xD2B48C }
};

// Three.jsの初期化
async function init() {
    // ローディング開始
    updateLoadingProgress(0);
    
    // Three.jsライブラリの読み込み確認
    updateLoadingProgress(1);
    await new Promise(resolve => setTimeout(resolve, 100)); // 少し待機
    
    // シーンの初期化
    updateLoadingProgress(2);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 空色の背景
    
    // 霧（フォグ）を追加して遠景を自然に（薄めに設定）
    scene.fog = new THREE.Fog(0x87CEEB, 100, 400);
    
    // カメラシステムの初期化
    cameraSystem = new CameraSystem(scene);
    camera = cameraSystem.initializeCamera(window.innerWidth, window.innerHeight);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // レンダラーをカメラシステムに設定
    cameraSystem.setRenderer(renderer);
    
    // ライティングの設定
    updateLoadingProgress(3);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // 街のレイアウトを生成
    updateLoadingProgress(4);
    cityLayout = new CityLayoutManager(cityLayoutConfig);
    const cityData = cityLayout.generateCity();
    
    // 自宅を先に生成
    updateLoadingProgress(5);
    if (typeof homeManager !== 'undefined') {
        homeManager.initializeHomes();
        console.log('自宅の初期化が完了しました');
    }
    
    console.log('建物と施設の生成が完了しました');

    // 建物と施設の生成
    updateLoadingProgress(6);
    
    // 地面とグリッドの生成
    updateLoadingProgress(7);
    // 無限大の地面（遠景用）
    const infiniteGroundGeometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
    const infiniteGroundMaterial = new THREE.MeshBasicMaterial({ 
        color: fieldColor, // 設定可能な色
        transparent: false // 透過を無効化
    });
    infiniteGroundMesh = new THREE.Mesh(infiniteGroundGeometry, infiniteGroundMaterial);
    infiniteGroundMesh.rotation.x = -Math.PI / 2;
    infiniteGroundMesh.position.y = -0.02; // 現在の地面より少し下に配置
    scene.add(infiniteGroundMesh);
    
    // 遠景の山々は削除（シンプルな遠景に）
    // createDistantMountains();
    
    // 地面（塗りつぶし）
    const groundSize = cityLayout.gridSize;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
    const groundMaterial = new THREE.MeshBasicMaterial({ 
        color: fieldColor, // 設定可能な色
        transparent: true,
        opacity: 0.6
    });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0.01; // 少し上に配置
    scene.add(groundMesh);
    
    // 地面のグリッド線（手動で作成）
    const gridGroup = new THREE.Group();
    const gridSize = groundSize;
    const gridSpacing = 2; // グリッドの間隔を小さく
    
    // 縦線
    for (let x = -gridSize/2; x <= gridSize/2; x += gridSpacing) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, 0, -gridSize/2),
            new THREE.Vector3(x, 0, gridSize/2)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFFFFFF, 
            transparent: true, 
            opacity: 0.8 
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        gridGroup.add(line);
    }
    
    // 横線
    for (let z = -gridSize/2; z <= gridSize/2; z += gridSpacing) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-gridSize/2, 0, z),
            new THREE.Vector3(gridSize/2, 0, z)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFFFFFF, 
            transparent: true, 
            opacity: 0.8 
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        gridGroup.add(line);
    }
    
    gridGroup.position.y = 0.03; // 床より少し上に配置
    scene.add(gridGroup);
    
    // 場所の作成
    updateLoadingProgress(8);
    createLocations();
    
    // 自宅の3Dオブジェクトを作成
    updateLoadingProgress(9);
    if (typeof homeManager !== 'undefined' && typeof createAgentHome === 'function') {
        const allHomes = homeManager.getAllHomes();
        allHomes.forEach(home => {
            createAgentHome(home);
        });
        console.log(`${allHomes.length}軒の自宅の3Dオブジェクトを作成しました`);
    }
    
    // カメラコントロールの設定
    updateLoadingProgress(10);
    cameraSystem.setupMouseControls();
    cameraSystem.setupKeyboardControls();
    
    // アニメーションループ
    animate();

    // 都市全体の描画
    updateLoadingProgress(11);
    cityLayout.drawCity();
    
    // 入り口接続は通常の道路描画に統合済み

    // UIパネルの初期化
    updateLoadingProgress(12);
    // パネルのHTMLを更新
    updatePanelHTML();
    
    // パネルのドラッグ機能を設定
    setupPanelDrag();
    
    // エージェント詳細モーダルの初期化
    setupAgentDetailModal();

    // localStorageからAPIキーを読み込み
    loadApiKeyFromStorage();

    // APIキーの変更を監視してlocalStorageに保存
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', (e) => {
            const newKey = e.target.value.trim();
            if (newKey) {
                saveApiKeyToStorage(newKey);
            }
        });
    }

    // localStorageからプロンプトを読み込み
    loadPromptFromStorage();

    // プロンプトの変更を監視してlocalStorageに保存
    const topicPromptInput = document.getElementById('topicPrompt');
    if (topicPromptInput) {
        topicPromptInput.addEventListener('input', (e) => {
            const newPrompt = e.target.value.trim();
            savePromptToStorage(newPrompt);
        });
    }

    // タブ機能の初期化
    setupTabNavigation();
    
    // APIアクセス回数の表示を初期化
    updateLlmCallCountDisplay();

    // 保存されたエージェントの自動読み込みは無効化
    // 手動で「保存されたエージェントを読み込み」ボタンを押してから読み込む

    // 天候システムの初期化
    updateLoadingProgress(13);
    if (typeof initWeatherSystem === 'function') {
        initWeatherSystem();
        createWeatherDisplay();
    }

    // 車両システムの初期化
    updateLoadingProgress(14);
    setTimeout(() => {
        if (typeof initializeVehicleSystem === 'function') {
            initializeVehicleSystem();
        }
    }, 1000); // 1秒後に初期化

    // 道路沿いに木を配置
    updateLoadingProgress(15, '道路沿いに木を配置中...');
    if (typeof placeTreesAlongRoads === 'function') {
        placeTreesAlongRoads();
    }

    // 最終調整
    updateLoadingProgress(16);
    await new Promise(resolve => setTimeout(resolve, 200)); // 少し待機
    
    // ローディング画面を非表示
    hideLoadingScreen();

    // シミュレーション制御ボタンのイベント登録
    const startBtn = document.getElementById('startSimulationBtn');
    if (startBtn) {
        console.log('Setting up start button listener in init');
        startBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Start button clicked in init');
            startSimulation();
        });
    } else {
        console.log('Start button not found in init');
    }
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            pauseSimulation();
        });
    }
    
    const speedBtn = document.getElementById('timeSpeedBtn');
    if (speedBtn) {
        speedBtn.addEventListener('click', function(e) {
            e.preventDefault();
            setTimeSpeed();
        });
    }
    
    // カメラ制御ボタンのイベント登録
    const personBtn = document.getElementById('personViewBtn');
    const facilityBtn = document.getElementById('facilityViewBtn');
    const resetBtn = document.getElementById('resetCamera');

    if (personBtn) {
        personBtn.addEventListener('click', () => {
            if (agents.length === 0) return;
            cameraSystem.currentAgentIndex = (cameraSystem.currentAgentIndex + 1) % agents.length;
            cameraSystem.focusCameraOnAgentByIndex(cameraSystem.currentAgentIndex, agents);
        });
    }
    if (facilityBtn) {
        facilityBtn.addEventListener('click', () => {
            const facilities = locations.filter(loc => !loc.isHome);
            if (facilities.length === 0) return;
            cameraSystem.currentFacilityIndex = (cameraSystem.currentFacilityIndex + 1) % facilities.length;
            cameraSystem.focusCameraOnFacilityByIndex(cameraSystem.currentFacilityIndex, locations);
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => cameraSystem.resetCamera());
    }

    // 道路表示ボタンのイベント登録
    const toggleRoadBtn = document.getElementById('toggleRoadNetwork');
    const clearRoadBtn = document.getElementById('clearRoadVisualization');

    if (toggleRoadBtn) {
        toggleRoadBtn.addEventListener('click', () => {
            cityLayout.visualizeRoadNetwork();
            addLog('🛣️ 道路ネットワークの視覚化を開始しました', 'system');
        });
    }
    if (clearRoadBtn) {
        clearRoadBtn.addEventListener('click', () => {
            cityLayout.clearVisualizations();
            addLog('🗑️ 道路表示をクリアしました', 'system');
        });
    }

    // 入り口接続表示ボタンのイベント登録
    const toggleEntranceBtn = document.getElementById('toggleEntranceConnections');
    if (toggleEntranceBtn) {
        toggleEntranceBtn.addEventListener('click', () => {
            // 入り口接続は通常の道路として常に表示されています
            addLog('🚪 入り口接続は通常の道路として常に表示されています', 'system');
        });
    }

    // 車両システムのイベント登録
    const vehicleCountSlider = document.getElementById('vehicleCount');
    const currentVehicleCount = document.getElementById('currentVehicleCount');
    const vehicleStatsCurrent = document.getElementById('vehicleStatsCurrent');
    const vehicleStatsInterval = document.getElementById('vehicleStatsInterval');
    const clearAllVehiclesBtn = document.getElementById('clearAllVehiclesBtn');
    const toggleVehicleSystemBtn = document.getElementById('toggleVehicleSystemBtn');

    if (vehicleCountSlider) {
        vehicleCountSlider.addEventListener('input', (e) => {
            const count = parseInt(e.target.value);
            currentVehicleCount.textContent = count;
            setVehicleCount(count);
        });
    }

    if (clearAllVehiclesBtn) {
        clearAllVehiclesBtn.addEventListener('click', () => {
            if (vehicleManager) {
                vehicleManager.clearAllVehicles();
                addLog('🚗 すべての車両を削除しました', 'system');
            }
        });
    }

    if (toggleVehicleSystemBtn) {
        toggleVehicleSystemBtn.addEventListener('click', () => {
            if (vehicleManager) {
                const isEnabled = vehicleManager.maxVehicles > 0;
                if (isEnabled) {
                    vehicleManager.setMaxVehicles(0);
                    toggleVehicleSystemBtn.textContent = '車両システムON';
                    addLog('🚗 車両システムを停止しました', 'system');
                } else {
                    vehicleManager.setMaxVehicles(15);
                    toggleVehicleSystemBtn.textContent = '車両システムOFF';
                    addLog('🚗 車両システムを開始しました', 'system');
                }
            }
        });
    }

    // 車両統計の定期更新
    setInterval(() => {
        if (vehicleManager) {
            const stats = vehicleManager.getStats();
            if (vehicleStatsCurrent) vehicleStatsCurrent.textContent = stats.current;
            if (vehicleStatsInterval) vehicleStatsInterval.textContent = stats.spawnInterval;
        }
    }, 1000);

    // フィールド色選択ボタンのイベント登録
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            const colorKey = button.getAttribute('data-color');
            if (fieldColorPresets[colorKey]) {
                const colorHex = fieldColorPresets[colorKey].color;
                changeFieldColor(colorHex);
                
                // 選択されたボタンをハイライト
                colorButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                
                addLog(`🎨 フィールド色を${fieldColorPresets[colorKey].name}に変更しました`, 'system');
            }
        });
    });
    
    // デフォルトでブラックを選択状態にする
    const blackButton = document.querySelector('[data-color="black"]');
    if (blackButton) {
        blackButton.classList.add('selected');
    }
    
    // 初期フィールド色に合わせて道路色を設定
    updateRoadColorsByField(fieldColor);
}

// パネルドラッグ状態を監視する関数をグローバルに公開
window.setPanelDragging = function(dragging) {
    if (cameraSystem) {
        cameraSystem.setPanelDragging(dragging);
    }
};

// エージェントの作成
function createAgents() {
    console.log('createAgents called');
    console.log('agentPersonalities:', agentPersonalities);
    
    // すでに初期エージェントが存在する場合は何もしない
    if (agents.length > 0) {
        console.log('Agents already exist, skipping creation');
        return;
    }
    
    agentPersonalities.forEach((data, index) => {
        console.log('Creating agent:', data.name);
        
        // エージェントにランダムで自宅を割り当て
        const home = homeManager.getRandomAvailableHome();
        if (home) {
            data.home = home;
            home.occupant = data.name;
        } else {
            console.error(`エージェント「${data.name}」に自宅を割り当てできませんでした。`);
            return;
        }
        
        const agent = new Agent(data, index);
        agents.push(agent);
    });
    
    console.log('Created agents:', agents.length);
    updateAgentInfo();
}

// 時間システム
function updateTime() {
    if (!simulationRunning || simulationPaused) return;
    
    const currentElapsedTime = clock.getElapsedTime();
    
    // 時間更新の間隔を制御（configから読み込み）
    if (currentElapsedTime - lastTimeUpdate < timeUpdateInterval) {
        return;
    }
    
    lastTimeUpdate = currentElapsedTime;
    
    // 1日の長さをconfigから計算（分単位）
    const dayLengthMinutes = timeConfig.dayLengthMinutes;
    const timeIncrement = (24 * 60) / (dayLengthMinutes * 60); // 1秒あたりの時間増分
    
    currentTime += timeSpeed * timeIncrement;
    if (currentTime >= 24 * 60) {
        currentTime = 0;
    }
    
    const hours = Math.floor(currentTime / 60);
    const minutes = Math.floor(currentTime % 60);
    
    // 時間表示形式をconfigから読み込み
    let timeString;
    if (timeConfig.timeFormat === '24hour') {
        timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else {
        timeString = `${hours < 12 ? '午前' : '午後'} ${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${minutes.toString().padStart(2, '0')}`;
    }
    
    if (timeConfig.showTime) {
        document.getElementById('time-display').textContent = timeString;
    }
    
    // 時間帯による環境の変化
    updateEnvironment(hours);
}

function updateEnvironment(hour) {
    // 天候システムが有効な場合は、天候による環境効果を優先
    if (weatherSystem) {
        weatherSystem.applyWeatherEffects();
        return;
    }
    
    // 従来の時間帯による環境変化（天候システムが無効な場合のフォールバック）
    let skyColor;
    let fogColor;
    let ambientIntensity;
    let directionalIntensity;
    
    if (hour < 6 || hour > 20) {
        skyColor = new THREE.Color(0x1a1a2e); // 夜
        fogColor = new THREE.Color(0x1a1a2e);
        ambientIntensity = 0.2;
        directionalIntensity = 0.3;
    } else if (hour < 8 || hour > 18) {
        skyColor = new THREE.Color(0x87CEEB); // 朝夕（空色）
        fogColor = new THREE.Color(0x87CEEB);
        ambientIntensity = 0.25;
        directionalIntensity = 0.35;
    } else {
        skyColor = new THREE.Color(0x87CEEB); // 昼（明るい空色）
        fogColor = new THREE.Color(0x87CEEB);
        ambientIntensity = 0.18;
        directionalIntensity = 0.25;
    }
    
    scene.background = skyColor;
    scene.fog.color = fogColor;
    
    // ライトの強度を更新
    scene.children.forEach(child => {
        if (child instanceof THREE.AmbientLight) {
            child.intensity = ambientIntensity;
        } else if (child instanceof THREE.DirectionalLight) {
            child.intensity = directionalIntensity;
        }
    });
}

// UI更新
function updateAgentInfo() {
    const agentsList = document.getElementById('agents-list');
    agentsList.innerHTML = '';
    
    agents.forEach(agent => {
        const agentCard = document.createElement('div');
        agentCard.className = 'agent-card';
        
        // 基本情報
        const nameDiv = document.createElement('div');
        nameDiv.className = 'agent-name';
        nameDiv.innerHTML = `
            <span class="agent-status status-active"></span>
            ${agent.name} (${agent.age}歳)
            ${agent.isThinking ? '<span class="thinking-indicator"></span>' : ''}
            <button class="agent-detail-btn" onclick="showAgentDetailModal(${agents.indexOf(agent)})">詳細</button>
        `;
        agentCard.appendChild(nameDiv);
        
        // 背景情報
        if (agent.background) {
            const backgroundDiv = document.createElement('div');
            backgroundDiv.className = 'agent-background';
            backgroundDiv.innerHTML = `
                <div class="agent-info-row">🏠 出身地: ${agent.background.birthplace}</div>
                <div class="agent-info-row">🎓 学歴: ${agent.background.education}</div>
                <div class="agent-info-row">💼 職業: ${agent.background.career}</div>
                <div class="agent-info-row">🎨 趣味: ${agent.background.hobbies.join(', ')}</div>
                <div class="agent-info-row">⛪ 宗教: ${agent.background.religion}</div>
                <div class="agent-info-row">👨‍👩‍👧‍👦 家族: ${agent.background.family}</div>
            `;
            agentCard.appendChild(backgroundDiv);
        }
        
        // 現在の情報
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `
            <div class="agent-info-row">📍 場所: ${agent.currentLocation.name}</div>
            <div class="agent-info-row">🎯 目的地: ${agent.getDestinationInfo()}</div>
            <div class="agent-info-row">⚡ 体力: ${Math.round(agent.energy * 100)}%</div>
            <div class="agent-info-row">😊 気分: ${agent.mood}</div>
        `;
        agentCard.appendChild(infoDiv);
        
        // 性格・価値観情報
        if (agent.personality) {
            const personalityDiv = document.createElement('div');
            personalityDiv.className = 'agent-personality';
            personalityDiv.innerHTML = `
                <div class="agent-info-row">💭 性格: ${agent.personality.description}</div>
                <div class="agent-info-row">🎯 価値観: ${agent.personality.values}</div>
                <div class="agent-info-row">🌟 目標: ${agent.personality.goals}</div>
            `;
            agentCard.appendChild(personalityDiv);
        }
        
        // 現在の思考
        if (agent.currentThought) {
            const thoughtDiv = document.createElement('div');
            thoughtDiv.className = 'agent-thought';
            thoughtDiv.textContent = agent.currentThought;
            agentCard.appendChild(thoughtDiv);
        }
        
        // 最近の記憶
        if (agent.shortTermMemory.length > 0) {
            const memoryDiv = document.createElement('div');
            memoryDiv.className = 'agent-memory';
            memoryDiv.innerHTML = '<strong>最近の記憶:</strong>';
            
            const recentMemories = agent.shortTermMemory.slice(-3);
            recentMemories.forEach(memory => {
                const memoryItem = document.createElement('div');
                memoryItem.className = 'memory-item';
                memoryItem.textContent = `• ${memory.event}`;
                memoryDiv.appendChild(memoryItem);
            });
            
            agentCard.appendChild(memoryDiv);
        }
        
        // 関係性情報
        const relationshipsDiv = document.createElement('div');
        relationshipsDiv.className = 'relationship-info';
        relationshipsDiv.innerHTML = '<strong>関係性:</strong>';
        
        let hasRelationships = false;
        agent.relationships.forEach((rel, name) => {
            if (rel.interactionCount > 0) {
                hasRelationships = true;
                const relItem = document.createElement('div');
                relItem.className = 'relationship-item';
                relItem.innerHTML = `
                    <span>${name}:</span>
                    <div class="relationship-bar">
                        <div class="relationship-fill" style="width: ${rel.affinity * 100}%"></div>
                    </div>
                `;
                relationshipsDiv.appendChild(relItem);
            }
        });
        
        if (hasRelationships) {
            agentCard.appendChild(relationshipsDiv);
        }
        
        agentsList.appendChild(agentCard);
    });
    
    // シミュレーション開始ボタンの状態を更新
    updateSimulationButton();
}

// シミュレーション制御
function startSimulation() {
    console.log('startSimulation called');
    console.log('Current agents:', agents.length);
    
    // エージェントの存在チェック
    if (agents.length === 0) {
        console.log('No agents found, creating agents...');
        createAgents();
        
        // エージェント作成後も空の場合はエラー
        if (agents.length === 0) {
            addLog('❌ エージェントの生成に失敗しました。', 'error');
            return;
        }
    }
    
    apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) {
        alert('OpenAI APIキーを入力してください');
        return;
    }

    // APIキーの形式を検証（プロバイダーによって分岐）
    const provider = getSelectedApiProvider();
    if (provider === 'openai') {
        if (!(apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-'))) {
            alert('無効なOpenAI APIキー形式です。sk-またはsk-proj-で始まる有効なAPIキーを入力してください。');
            return;
        }
    } else if (provider === 'gemini') {
        // GeminiのAPIキーは任意の形式を許可
        if (!apiKey || apiKey.trim() === '') {
            alert('Gemini APIキーを入力してください。');
            return;
        }
    }
    
    console.log('Starting simulation...');
    simulationRunning = true;
    simulationPaused = false;
    
    // 一時停止ボタンを有効化
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.disabled = false;
    }
    
    addLog('<span style="color: #4CAF50;">🎬 シミュレーション開始</span>');
    console.log('Simulation started successfully');
}

// タブ機能の設定
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // すべてのタブボタンからactiveクラスを削除
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // すべてのタブペインからactiveクラスを削除
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // クリックされたボタンと対応するペインにactiveクラスを追加
            button.classList.add('active');
            const targetPane = document.getElementById(targetTab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}

// グローバルスコープに関数を公開
window.startSimulation = startSimulation;
window.pauseSimulation = pauseSimulation;
window.setTimeSpeed = setTimeSpeed;
window.showAgentDetailModal = function(agentIndex) {
    if (agents[agentIndex] && typeof window._showAgentDetailModal === 'function') {
        window._showAgentDetailModal(agents[agentIndex]);
    }
};

function pauseSimulation() {
    simulationPaused = !simulationPaused;
    document.getElementById('pauseBtn').textContent = simulationPaused ? '再開' : '一時停止';
    
    if (simulationPaused) {
        addLog('<span style="color: #FFC107;">⏸️ シミュレーション一時停止</span>');
    } else {
        addLog('<span style="color: #4CAF50;">▶️ シミュレーション再開</span>');
    }
}

function setTimeSpeed() {
    const speeds = [1, 2, 5, 10];
    const currentIndex = speeds.indexOf(timeSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    timeSpeed = speeds[nextIndex];
    
    // 時間更新間隔を速度に応じて調整（configベース）
    const baseInterval = timeConfig.timeUpdateInterval / 1000; // 基本間隔（秒）
    switch (timeSpeed) {
        case 1:
            timeUpdateInterval = baseInterval; // 基本間隔
            break;
        case 2:
            timeUpdateInterval = baseInterval / 2; // 2倍速
            break;
        case 5:
            timeUpdateInterval = baseInterval / 5; // 5倍速
            break;
        case 10:
            timeUpdateInterval = baseInterval / 10; // 10倍速
            break;
    }
    
    document.getElementById('speed').textContent = `${timeSpeed}x`;
}

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    
    // 時間の更新
    updateTime();
    
    // 天候の更新
    updateWeather();
    
    // 車両システムの更新
    updateVehicleSystem(deltaTime);
    
    // エージェントの更新
    if (agents.length > 0) {
        agents.forEach(agent => {
            agent.update(deltaTime);
        });
        
        // UI更新（1秒ごと）
        if (Math.floor(clock.getElapsedTime()) % 1 === 0) {
            updateAgentInfo();
        }
    }
    
    // カメラシステムの更新
    cameraSystem.updateCameraFollow();
    cameraSystem.updateCameraMovement(deltaTime);
    
    // 追従対象の表示を更新（0.5秒ごと）
    if (Math.floor(clock.getElapsedTime() * 2) % 1 === 0) {
        cameraSystem.updateCameraTargetDisplay();
    }
    
    // ターゲットマーカーのアニメーション
    if (window.targetMarkerAnimation) {
        window.targetMarkerAnimation();
    }
    
    renderer.render(scene, camera);
}

// ウィンドウリサイズ対応
window.addEventListener('resize', () => {
    cameraSystem.onWindowResize(window.innerWidth, window.innerHeight);
});

    // 初期化（非同期）
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('DOM loaded, starting initialization');
        await init();
        console.log('Initialization completed');
    });
    
    // ボタンのイベントリスナーを設定
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded, setting up button listeners');
        
        const startButton = document.getElementById('startSimulationBtn');
        if (startButton) {
            console.log('Found start button, adding event listener');
            startButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Start button clicked via event listener');
                startSimulation();
            });
        } else {
            console.log('Start button not found');
        }
        
        const pauseButton = document.getElementById('pauseBtn');
        if (pauseButton) {
            pauseButton.addEventListener('click', function(e) {
                e.preventDefault();
                pauseSimulation();
            });
        }
        
        const speedButton = document.getElementById('timeSpeedBtn');
        if (speedButton) {
            speedButton.addEventListener('click', function(e) {
                e.preventDefault();
                setTimeSpeed();
            });
        }
    });

// APIプロバイダー選択値を取得
function getSelectedApiProvider() {
    const radio = document.querySelector('input[name="apiProvider"]:checked');
    return radio ? radio.value : 'openai';
}
window.getSelectedApiProvider = getSelectedApiProvider;

// LLMへの問い合わせ回数更新関数をグローバルに公開
window.updateLlmCallCount = updateLlmCallCount;





// エージェント情報パネルで指定されたエージェントまでスクロール
function scrollToAgentInfo(targetAgent) {
    const agentsList = document.getElementById('agents-list');
    if (!agentsList) return;
    
    // エージェント情報パネル内のすべてのエージェントカードを取得
    const agentCards = agentsList.querySelectorAll('.agent-card');
    
    // 該当エージェントのカードを探す
    let targetCard = null;
    agentCards.forEach(card => {
        const nameElement = card.querySelector('.agent-name');
        if (nameElement && nameElement.textContent.includes(targetAgent.name)) {
            targetCard = card;
        }
    });
    
    if (targetCard) {
        // 該当エージェントのカードまでスムーズにスクロール
        targetCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // 一時的にハイライト表示
        targetCard.style.backgroundColor = '#4CAF50';
        targetCard.style.color = 'white';
        
        // 3秒後にハイライトを解除
        setTimeout(() => {
            targetCard.style.backgroundColor = '';
            targetCard.style.color = '';
        }, 3000);
    }
}

// エージェントごとのメッセージ履歴管理
const messageHistories = new Map(); // エージェント名 -> メッセージ履歴
let currentMessageAgent = null;
let isCallActive = false;

// エージェントのメッセージ履歴を取得または初期化
function getMessageHistory(agentName) {
    if (!messageHistories.has(agentName)) {
        messageHistories.set(agentName, []);
    }
    return messageHistories.get(agentName);
}

    // エージェントのメッセージ履歴をクリア
    function clearMessageHistory(agentName) {
        messageHistories.set(agentName, []);
        console.log(`${agentName}のメッセージ履歴をクリアしました`);
    }
    
    // 現在のエージェントのメッセージ履歴をクリア
    function clearCurrentMessageHistory() {
        if (currentMessageAgent) {
            clearMessageHistory(currentMessageAgent.name);
            updateMessageHistory();
        }
    }

// シミュレーション開始ボタンの状態を更新
function updateSimulationButton() {
    const startSimulationBtn = document.querySelector('button[onclick="startSimulation()"]');
    if (startSimulationBtn) {
        if (agents.length === 0) {
            startSimulationBtn.disabled = true;
            startSimulationBtn.textContent = 'シミュレーション開始 (エージェントが必要)';
        } else {
            startSimulationBtn.disabled = false;
            startSimulationBtn.textContent = 'シミュレーション開始';
        }
    }
}

// グローバルスコープに公開
window.updateSimulationButton = updateSimulationButton;

// コミュニケーション機能の関数
function updateCommunicationButtons() {
    const callAgentBtn = document.getElementById('callAgentBtn');
    const messageAgentBtn = document.getElementById('messageAgentBtn');
    
    if (!callAgentBtn || !messageAgentBtn) return;
    
    // 人物視点モードでエージェントが選択されている場合のみ有効
    const isAgentSelected = cameraMode === 'agent' && targetAgent;
    
    callAgentBtn.disabled = !isAgentSelected || isCallActive;
    messageAgentBtn.disabled = !isAgentSelected;
    
    if (isAgentSelected) {
        callAgentBtn.textContent = isCallActive ? '📞 通話中...' : '📞 電話をかける';
        messageAgentBtn.textContent = '💬 メッセージを送る';
    } else {
        callAgentBtn.textContent = '📞 電話をかける';
        messageAgentBtn.textContent = '💬 メッセージを送る';
    }
}

function startCall() {
    if (!targetAgent || isCallActive) return;
    
    isCallActive = true;
    currentMessageAgent = targetAgent;
    
    // エージェントの履歴を取得
    const messageHistory = getMessageHistory(targetAgent.name);
    
    // 通話開始メッセージを追加
    addMessageToHistory('user', `📞 ${targetAgent.name}に電話をかけました`);
    addMessageToHistory('agent', `${targetAgent.name}: はい、もしもし。${targetAgent.name}です。`);
    
    updateCommunicationButtons();
    addLog(`📞 ${targetAgent.name}に電話をかけました`, 'communication');
    
    // 自動でメッセージモーダルを開く
    openMessageModal();
}

function openMessageModal() {
    if (!targetAgent) return;
    
    const messageModal = document.getElementById('messageModal');
    const messageModalTitle = document.getElementById('messageModalTitle');
    
    if (!messageModal || !messageModalTitle) return;
    
    currentMessageAgent = targetAgent;
    messageModalTitle.textContent = `${targetAgent.name}とのメッセージ`;
    
    // エージェントの履歴を初期化（初回の場合）
    if (!messageHistories.has(targetAgent.name)) {
        messageHistories.set(targetAgent.name, []);
    }
    
    // メッセージ履歴を表示
    updateMessageHistory();
    
    messageModal.style.display = 'block';
}

function closeMessageModalHandler() {
    const messageModal = document.getElementById('messageModal');
    if (messageModal) {
        messageModal.style.display = 'none';
    }
    
    // 通話を終了
    if (isCallActive) {
        endCall();
    }
}

function endCall() {
    if (!isCallActive) return;
    
    isCallActive = false;
    currentMessageAgent = null;
    
    updateCommunicationButtons();
    addLog(`📞 通話を終了しました`, 'communication');
}

function addMessageToHistory(sender, message) {
    if (!currentMessageAgent) return;
    
    const messageHistory = getMessageHistory(currentMessageAgent.name);
    messageHistory.push({
        sender: sender,
        message: message,
        timestamp: new Date()
    });
}

function updateMessageHistory() {
    const messageHistoryDiv = document.getElementById('messageHistory');
    if (!messageHistoryDiv || !currentMessageAgent) return;
    
    messageHistoryDiv.innerHTML = '';
    
    const messageHistory = getMessageHistory(currentMessageAgent.name);
    messageHistory.forEach(item => {
        const messageItem = document.createElement('div');
        messageItem.className = `message-item message-${item.sender}`;
        
        // タイムスタンプをフォーマット
        const timestamp = new Date(item.timestamp);
        const timeString = timestamp.toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // メッセージとタイムスタンプを表示
        messageItem.innerHTML = `
            <div class="message-content">${item.message}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        messageHistoryDiv.appendChild(messageItem);
    });
    
    // 最新のメッセージまでスクロール
    messageHistoryDiv.scrollTop = messageHistoryDiv.scrollHeight;
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput || !currentMessageAgent) return;
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // ユーザーのメッセージを履歴に追加
    addMessageToHistory('user', message);
    messageInput.value = '';
    
    // メッセージ履歴を更新
    updateMessageHistory();
    
    addLog(`💬 ${currentMessageAgent.name}にメッセージを送信: ${message}`, 'communication');
    
    // エージェントの返答を生成
    await generateAgentResponse(message);
}

async function generateAgentResponse(userMessage) {
    // 一時停止中はLLM APIコールをスキップ
    if (!simulationRunning || simulationPaused) {
        const fallbackResponse = `${currentMessageAgent.name}: シミュレーションが一時停止中のため、返答できません。`;
        addMessageToHistory('agent', fallbackResponse);
        updateMessageHistory();
        return;
    }
    
    if (!currentMessageAgent) return;
    
    try {
        // エージェントの性格と状況を考慮したプロンプトを作成
        const prompt = `
あなたは${currentMessageAgent.name}（${currentMessageAgent.age}歳、${currentMessageAgent.personality}）です。
現在の状況：
- 場所: ${currentMessageAgent.currentLocation.name}
- 気分: ${currentMessageAgent.mood}
- 体力: ${Math.round(currentMessageAgent.energy * 100)}%
- 現在の思考: ${currentMessageAgent.currentThought || '特にない'}

ユーザーからのメッセージ: "${userMessage}"

このメッセージに対して、${currentMessageAgent.name}らしい自然な返答を1-2文で返してください。
性格や現在の状況を反映した返答にしてください。
`;

        const response = await callLLM({
            prompt: prompt,
            systemPrompt: `あなたは${currentMessageAgent.name}です。自然で親しみやすい返答を心がけてください。`,
            maxTokens: 100,
            temperature: 0.8
        });
        
        // エージェントの返答を履歴に追加
        addMessageToHistory('agent', `${currentMessageAgent.name}: ${response}`);
        updateMessageHistory();
        
        addLog(`💬 ${currentMessageAgent.name}からの返答: ${response}`, 'communication');
        
    } catch (error) {
        console.error('エージェント返答生成エラー:', error);
        const fallbackResponse = `${currentMessageAgent.name}: すみません、今忙しくて返答できません。`;
        addMessageToHistory('agent', fallbackResponse);
        updateMessageHistory();
    }
}



// 遠景の山々を作成する関数
function createDistantMountains() {
    const mountainGroup = new THREE.Group();
    
    // 複数の山を配置
    const mountainPositions = [
        { x: -200, z: -150, height: 30, width: 80 },
        { x: 200, z: -180, height: 25, width: 60 },
        { x: -150, z: 200, height: 35, width: 90 },
        { x: 180, z: 220, height: 20, width: 50 },
        { x: 0, z: -300, height: 40, width: 100 },
        { x: -300, z: 0, height: 30, width: 70 },
        { x: 300, z: 50, height: 25, width: 65 }
    ];
    
    mountainPositions.forEach((mountain, index) => {
        // 山のジオメトリ（三角形の山）
        const mountainGeometry = new THREE.ConeGeometry(mountain.width, mountain.height, 8);
        const mountainMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4a5d23, // 山の色
            transparent: true,
            opacity: 0.7
        });
        const mountainMesh = new THREE.Mesh(mountainGeometry, mountainMaterial);
        
        mountainMesh.position.set(mountain.x, mountain.height / 2, mountain.z);
        mountainMesh.castShadow = false; // 影は無効
        mountainMesh.receiveShadow = false;
        
        mountainGroup.add(mountainMesh);
    });
    
    scene.add(mountainGroup);
}



// フィールド色を変更する関数
function changeFieldColor(colorHex) {
    fieldColor = colorHex;
    
    // 地面の色を更新
    if (groundMesh) {
        groundMesh.material.color.setHex(colorHex);
    }
    
    // 無限平面の色を更新
    if (infiniteGroundMesh) {
        infiniteGroundMesh.material.color.setHex(colorHex);
    }
    
    // フィールド色に合わせて道路色を更新
    updateRoadColorsByField(colorHex);
    
    console.log(`フィールド色を変更しました: ${colorHex.toString(16)}`);
}

// グローバルスコープに公開
window.changeFieldColor = changeFieldColor;

// 既存の道路の色を更新する関数
function updateExistingRoadColors(roadColor) {
    // シーン内の全ての道路メッシュを更新
    scene.children.forEach(child => {
        if (child.material && child.material.color) {
            // 現在の道路色と比較して、道路メッシュかどうかを判定
            const currentColor = child.material.color.getHex();
            if (currentColor === cityLayoutConfig.roadColors.mainRoad ||
                currentColor === cityLayoutConfig.roadColors.normalRoad ||
                currentColor === cityLayoutConfig.roadColors.entranceRoad ||
                currentColor === cityLayoutConfig.roadColors.homeRoad ||
                // 以前の色設定も含める
                currentColor === 0x444444 ||
                currentColor === 0x666666 ||
                currentColor === 0x808080 ||
                currentColor === 0x333333) {
                child.material.color.setHex(roadColor);
                console.log(`道路の色を更新: ${currentColor.toString(16)} → ${roadColor.toString(16)}`);
            }
        }
    });
    
    // 設定ファイルの道路色も更新
    cityLayoutConfig.roadColors.mainRoad = roadColor;
    cityLayoutConfig.roadColors.normalRoad = roadColor;
    cityLayoutConfig.roadColors.entranceRoad = roadColor;
    cityLayoutConfig.roadColors.homeRoad = roadColor;
}

// ローディング画面管理
let loadingProgress = 0;
let loadingSteps = [
    { message: 'Three.jsライブラリを読み込み中...', detail: '3Dレンダリングエンジンの初期化' },
    { message: 'シーンを初期化中...', detail: '3Dシーンの作成とカメラ設定' },
    { message: 'ライティングを設定中...', detail: '環境光と指向性ライトの配置' },
    { message: '都市レイアウトを生成中...', detail: '建物と施設の配置計画' },
    { message: '自宅を生成中...', detail: 'エージェント用の自宅オブジェクト作成' },
    { message: '建物と施設を生成中...', detail: '3D建物オブジェクトの配置' },
    { message: '地面とグリッドを生成中...', detail: '地面メッシュとグリッド線の作成' },
    { message: '場所データを作成中...', detail: '施設情報の初期化' },
    { message: '自宅の3Dオブジェクトを作成中...', detail: '自宅メッシュの配置' },
    { message: 'マウスコントロールを設定中...', detail: 'カメラ操作の初期化' },
    { message: '都市全体を描画中...', detail: '建物と道路の最終描画' },
    { message: 'UIパネルを初期化中...', detail: 'コントロールパネルの設定' },
    { message: '天候システムを初期化中...', detail: '天候エフェクトの準備' },
    { message: '車両システムを初期化中...', detail: '車両管理システムの準備' },
    { message: '道路沿いに木を配置中...', detail: '街路樹の配置' },
    { message: '最終調整中...', detail: 'システム全体の最終チェック' }
];

// ローディング進捗を更新する関数
function updateLoadingProgress(step, detail = '') {
    const progress = Math.round((step / loadingSteps.length) * 100);
    loadingProgress = progress;
    
    const loadingMessage = document.getElementById('loading-message');
    const loadingProgressElement = document.getElementById('loading-progress');
    const loadingDetailMessage = document.getElementById('loading-detail-message');
    
    if (loadingMessage && step < loadingSteps.length) {
        loadingMessage.textContent = loadingSteps[step].message;
    }
    
    if (loadingProgressElement) {
        loadingProgressElement.textContent = `${progress}%`;
    }
    
    if (loadingDetailMessage) {
        const detailText = detail || (step < loadingSteps.length ? loadingSteps[step].detail : '');
        loadingDetailMessage.textContent = detailText;
    }
    
    // 進捗に応じてローディング画面の色を変化させる
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        if (progress < 30) {
            loadingScreen.style.background = 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)';
        } else if (progress < 60) {
            loadingScreen.style.background = 'linear-gradient(135deg, #2a5298 0%, #4a90e2 100%)';
        } else if (progress < 90) {
            loadingScreen.style.background = 'linear-gradient(135deg, #4a90e2 0%, #7bb3f0 100%)';
        } else {
            loadingScreen.style.background = 'linear-gradient(135deg, #7bb3f0 0%, #a8d8ff 100%)';
        }
    }
}

// ローディング画面を非表示にする関数
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 500);
    }
}