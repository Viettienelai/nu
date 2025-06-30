// ==================== CẤU HÌNH TÙY CHỈNH ====================
const MAX_FILE_NUMBER = 20; // Thay đổi số này để tùy chỉnh số lượng file tối đa cần tải
// ============================================================

// Elements
const passwordOverlay = document.getElementById('passwordOverlay');
const passwordInput = document.getElementById('passwordInput');
const unlockBtn = document.getElementById('unlockBtn');
const passwordMessage = document.getElementById('passwordMessage');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const galleryContainer = document.getElementById('galleryContainer');
const contentContainer = document.getElementById('contentContainer');
const statsDiv = document.getElementById('statsDiv');
const mediaModal = document.getElementById('mediaModal');
const modalImage = document.getElementById('modalImage');
const modalVideo = document.getElementById('modalVideo');
const closeModal = document.getElementById('closeModal');
const navPrev = document.getElementById('navPrev');
const navNext = document.getElementById('navNext');
const navIndicator = document.getElementById('navIndicator');

// === PHẦN TỬ MỚI CHO TÍNH NĂNG KÉO THẢ ===
const unlockTarget = document.getElementById('unlockTarget');

let decryptedMedia = [];
let currentModalElement = null;
let currentMediaIndex = -1;
let preloadedData = null; // Lưu trữ data đã được giải mã

// CUSTOM LAYOUT CONFIGURATION
const layoutConfig = {
    1: {
        date: "20 Tháng 5, 2025",
        items: [1, 2, 3]
    },
    2: {
        date: "26 Tháng 5, 2025",
        items: [4, 5, 6, 7]
    },
    3: {
        date: "3 Tháng 6, 2025",
        items: [8]
    },
    4: {
        date: "29 Tháng 6, 2025",
        items: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    }
};

// Ngụy trang mật khẩu dưới dạng nhị phân
const binaryKey = "0111011001100101011011110111010001100101011011110110010101101111011011000110010101101111";

function decodeBinaryPassword() {
    const decoded = binaryKey.match(/.{8}/g).map(byte => String.fromCharCode(parseInt(byte, 2))).join('');
    return decoded;
}

// Hàm tạo khóa từ mật khẩu
async function getKeyFromPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// Hàm giải mã file
async function decryptFile(encryptedBuffer, password) {
    const dataBytes = new Uint8Array(encryptedBuffer);

    const saltLength = dataBytes[0];
    const ivLength = dataBytes[1];
    const salt = dataBytes.slice(2, 2 + saltLength);
    const iv = dataBytes.slice(2 + saltLength, 2 + saltLength + ivLength);
    const encryptedData = dataBytes.slice(2 + saltLength + ivLength);

    const key = await getKeyFromPassword(password, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encryptedData.buffer
    );

    return decryptedBuffer;
}

// Hàm kiểm tra file type
function getFileType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext)) {
        return 'image';
    } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
        return 'video';
    }
    return 'unknown';
}

function getMimeType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'avif': 'image/avif',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// Hàm cập nhật progress bar
function updateProgress(current, total, message = '') {
    const percentage = Math.round((current / total) * 100);
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = message || `${current}/${total} files loaded`;
}

// Hàm tải và giải mã media song song
async function preloadAndDecryptMedia() {
    const correctPassword = decodeBinaryPassword();
    const mediaPromises = [];
    let completedCount = 0;

    passwordMessage.innerHTML = '<div class="loading-message">Initializing Protocol . . .</div>';
    progressContainer.style.display = 'block';

    for (let i = 1; i <= MAX_FILE_NUMBER; i++) {
        const extensions = ['avif.enc', 'mp4.enc', 'webp.enc', 'jpg.enc', 'png.enc', 'webm.enc'];
        const filePromise = (async () => {
            for (const ext of extensions) {
                const filename = `assets/img/n${i}.${ext}`;
                try {
                    const response = await fetch(filename);
                    if (!response.ok) continue;

                    const encryptedBuffer = await response.arrayBuffer();
                    const decryptedBuffer = await decryptFile(encryptedBuffer, correctPassword);

                    const originalExt = ext.replace('.enc', '');
                    const fileType = getFileType(`file.${originalExt}`);
                    const mimeType = getMimeType(`file.${originalExt}`);

                    completedCount++;
                    updateProgress(completedCount, MAX_FILE_NUMBER, `${completedCount}/${MAX_FILE_NUMBER} Data Clusters`);

                    return {
                        id: i,
                        decryptedBuffer: decryptedBuffer,
                        filename: `n${i}.${originalExt}`,
                        type: fileType,
                        mimeType: mimeType,
                        size: (decryptedBuffer.byteLength / 1024).toFixed(2) + ' KB'
                    };
                } catch (error) {
                    console.error(`Lỗi giải mã ${filename}:`, error);
                }
            }
            completedCount++;
            updateProgress(completedCount, MAX_FILE_NUMBER, `Đã kiểm tra ${completedCount}/${MAX_FILE_NUMBER} files`);
            return null;
        })();
        mediaPromises.push(filePromise);
    }

    const results = await Promise.all(mediaPromises);
    const media = results.filter(item => item !== null);
    media.sort((a, b) => a.id - b.id);

    progressContainer.style.display = 'none';
    passwordMessage.innerHTML = '<div class="loading-message">Validated</div>';

    return { media, successCount: media.length };
}

// Hàm tạo URL từ preloaded data và đảm bảo tất cả media load xong
async function createMediaUrlsAndWaitForLoad(media) {
    const mediaWithUrls = media.map(item => ({
        ...item,
        url: URL.createObjectURL(new Blob([item.decryptedBuffer], { type: item.mimeType })),
        loaded: false
    }));

    const loadPromises = mediaWithUrls.map(item => {
        return new Promise((resolve) => {
            if (item.type === 'image') {
                const img = new Image();
                img.onload = () => { item.loaded = true; resolve(); };
                img.onerror = () => { console.error(`Lỗi load ảnh: ${item.filename}`); item.loaded = true; resolve(); };
                img.src = item.url;
            } else if (item.type === 'video') {
                const video = document.createElement('video');
                video.onloadeddata = () => { item.loaded = true; resolve(); };
                video.onerror = () => { console.error(`Lỗi load video: ${item.filename}`); item.loaded = true; resolve(); };
                video.src = item.url;
                video.preload = 'metadata';
            } else {
                item.loaded = true;
                resolve();
            }
        });
    });

    await Promise.all(loadPromises);
    return mediaWithUrls;
}

// === TÁCH LOGIC MỞ KHÓA RA HÀM RIÊNG ===
// Hàm này sẽ được gọi khi mở khóa thành công (bằng pass hoặc kéo thả)
async function initiateUnlock() {
    if (!preloadedData) {
        passwordMessage.innerHTML = '<div class="error-message">Dữ liệu chưa sẵn sàng!</div>';
        return;
    }

    // Vô hiệu hóa các nút và input
    passwordInput.disabled = true;

    passwordMessage.innerHTML = '<div class="loading-message">Orchestrating Digital Canvas . . .</div>';
    progressContainer.style.display = 'block';
    updateProgress(0, preloadedData.media.length, 'Preparing . . .');

    try {
        decryptedMedia = await createMediaUrlsAndWaitForLoad(preloadedData.media);
        updateProgress(preloadedData.media.length, preloadedData.media.length, 'Terminated');

        setTimeout(() => {
            passwordOverlay.style.display = 'none';
            galleryContainer.style.display = 'block';
            statsDiv.textContent = `Đã tải thành công ${preloadedData.successCount} media`;
            createGalleryStructure(decryptedMedia);
            setTimeout(() => {
                galleryContainer.classList.add('show');
            }, 100);
        }, 500);

    } catch (error) {
        console.error('Lỗi:', error);
        passwordMessage.innerHTML = '<div class="error-message">Có lỗi xảy ra khi hiển thị media!</div>';
        passwordInput.disabled = false;
        progressContainer.style.display = 'none';
    }
}


// === LOGIC KÉO THẢ MỚI VỚI GSAP ===
// === LOGIC KÉO THẢ MỚI VỚI GSAP (ĐÃ SỬA LỖI) ===
function setupDragAndDropUnlock() {
    Draggable.create(unlockBtn, {
        type: "x,y", // Cho phép kéo theo cả 2 trục
        bounds: passwordOverlay, // Giới hạn kéo trong phạm vi của overlay

        // Hàm được gọi liên tục khi đang kéo
        onDrag: function () {
            // hitTest kiểm tra xem 2 đối tượng có va chạm không
            if (this.hitTest(unlockTarget, "50%")) { // "50%" nghĩa là cần >50% diện tích va chạm
                unlockBtn.classList.add("active");
                // Không thay đổi unlockTarget
            } else {
                unlockBtn.classList.remove("active");
                // Không thay đổi unlockTarget
            }
        },

        // Hàm được gọi khi thả chuột
        onRelease: function () {
            // Kiểm tra nếu thả ra khi đang va chạm với vùng đích
            if (this.hitTest(unlockTarget, "50%")) {
                this.disable(); // Vô hiệu hóa việc kéo thả tiếp

                // Tính toán vị trí để đưa nút vào chính giữa vùng đích
                // Lấy vị trí của container cha (passwordContainer) làm gốc tọa độ
                const containerRect = document.querySelector('.password-container').getBoundingClientRect();
                const targetRect = unlockTarget.getBoundingClientRect();
                const btnRect = unlockBtn.getBoundingClientRect();

                // Tính toán vị trí tương đối so với container
                const targetCenterX = targetRect.left + targetRect.width / 2 - containerRect.left;
                const targetCenterY = targetRect.top + targetRect.height / 2 - containerRect.top;
                const btnCenterX = btnRect.left + btnRect.width / 2 - containerRect.left;
                const btnCenterY = btnRect.top + btnRect.height / 2 - containerRect.top;

                // Tính toán khoảng cách cần di chuyển để căn giữa
                const deltaX = targetCenterX - btnCenterX;
                const deltaY = targetCenterY - btnCenterY;

                // Di chuyển nút đến vị trí chính xác
                gsap.to(this.target, {
                    x: this.x + deltaX, // Cộng thêm vào vị trí hiện tại
                    y: this.y + deltaY, // Cộng thêm vào vị trí hiện tại
                    duration: 0.1,
                    onComplete: initiateUnlock // Khi di chuyển xong, gọi hàm mở khóa
                });

            } else {
                // Nếu không, đưa nút trở lại vị trí ban đầu
                gsap.to(this.target, {
                    x: 0,
                    y: 0,
                    duration: 0.3
                });
                unlockBtn.classList.remove("active");
                // Không thay đổi unlockTarget
            }
        }
    });
}


// === CÁC HÀM CŨ CHO GALLERY VÀ MODAL (Không thay đổi) ===
function updateNavigationIndicator() {
    if (currentMediaIndex >= 0 && currentMediaIndex < decryptedMedia.length) {
        navIndicator.textContent = `${currentMediaIndex + 1} / ${decryptedMedia.length}`;
    }
    navPrev.classList.toggle('disabled', currentMediaIndex <= 0);
    navNext.classList.toggle('disabled', currentMediaIndex >= decryptedMedia.length - 1);
}

function showMediaAtIndex(index) {
    if (index < 0 || index >= decryptedMedia.length) return;
    currentMediaIndex = index;
    const mediaItem = decryptedMedia[index];
    if (mediaItem.type === 'image') {
        modalImage.src = mediaItem.url;
        modalImage.style.display = 'block';
        modalVideo.style.display = 'none';
        currentModalElement = modalImage;
    } else if (mediaItem.type === 'video') {
        if (modalVideo.src) modalVideo.pause();
        modalVideo.src = mediaItem.url;
        modalVideo.style.display = 'block';
        modalImage.style.display = 'none';
        currentModalElement = modalVideo;
    }
    updateNavigationIndicator();
}

function navigatePrevious() { if (currentMediaIndex > 0) showMediaAtIndex(currentMediaIndex - 1); }
function navigateNext() { if (currentMediaIndex < decryptedMedia.length - 1) showMediaAtIndex(currentMediaIndex + 1); }

function showModal(mediaItem) {
    currentMediaIndex = decryptedMedia.findIndex(item => item.id === mediaItem.id);
    showMediaAtIndex(currentMediaIndex);
    mediaModal.style.display = 'block';
    setTimeout(() => {
        mediaModal.classList.add('show');
        mediaModal.classList.add('zoom-in');
    }, 10);
}

function hideModal() {
    mediaModal.classList.remove('zoom-in');
    mediaModal.classList.add('zoom-out');
    mediaModal.classList.remove('show');
    setTimeout(() => {
        mediaModal.style.display = 'none';
        mediaModal.classList.remove('zoom-out');
        if (modalVideo.src) {
            modalVideo.pause();
            modalVideo.src = '';
        }
        modalImage.src = '';
        currentModalElement = null;
        currentMediaIndex = -1;
    }, 300);
}

function createGalleryStructure(media) {
    contentContainer.innerHTML = '';
    const mediaMap = {};
    media.forEach(item => { mediaMap[item.id] = item; });

    Object.keys(layoutConfig).sort((a, b) => parseInt(b) - parseInt(a)).forEach(containerId => {
        const config = layoutConfig[containerId];
        const dateDiv = document.createElement('div');
        dateDiv.className = 'date';
        dateDiv.id = containerId;
        dateDiv.textContent = config.date;
        contentContainer.appendChild(dateDiv);

        const containerDiv = document.createElement('div');
        containerDiv.className = 'container';
        containerDiv.id = containerId;
        contentContainer.appendChild(containerDiv);

        config.items.forEach((itemId, position) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';
            if (itemId === null || itemId === undefined) {
                itemDiv.style.opacity = '0';
                itemDiv.id = `empty_${containerId}_${position}`;
            } else {
                const mediaItem = mediaMap[itemId];
                itemDiv.id = itemId.toString();
                if (mediaItem) {
                    if (mediaItem.type === 'image') {
                        const img = document.createElement('img');
                        img.src = mediaItem.url;
                        img.alt = mediaItem.filename;
                        img.loading = 'lazy';
                        itemDiv.appendChild(img);
                    } else if (mediaItem.type === 'video') {
                        const video = document.createElement('video');
                        video.src = mediaItem.url;
                        video.muted = true;
                        video.loop = true;
                        video.autoplay = true;
                        itemDiv.appendChild(video);
                    }
                    itemDiv.addEventListener('click', (e) => {
                        itemDiv.classList.add('clicking');
                        setTimeout(() => {
                            itemDiv.classList.remove('clicking');
                            showModal(mediaItem);
                        }, 150);
                    });
                    setTimeout(() => { itemDiv.classList.add('loaded'); }, position * 100);
                } else {
                    itemDiv.style.opacity = '0.5';
                    itemDiv.style.background = '#333';
                    const placeholder = document.createElement('div');
                    placeholder.style.cssText = `display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 0.8em;`;
                    placeholder.textContent = `n${itemId}`;
                    itemDiv.appendChild(placeholder);
                }
            }
            containerDiv.appendChild(itemDiv);
        });
    });
}

// Xử lý sự kiện unlock bằng mật khẩu (vẫn giữ lại)
unlockBtn.addEventListener('click', async () => {
    const password = passwordInput.value.trim();
    if (!password) {
        passwordMessage.innerHTML = '<div class="error-message">Enter Credentials!</div>';
        return;
    }
    const correctPassword = decodeBinaryPassword();
    if (password !== correctPassword) {
        passwordMessage.innerHTML = '<div class="error-message">Anomaly!</div>';
        return;
    }
    // Gọi hàm mở khóa chung
    initiateUnlock();
});

// Xử lý Enter key
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') unlockBtn.click(); });
closeModal.addEventListener('click', () => { hideModal(); });
mediaModal.addEventListener('click', (e) => { if (e.target === mediaModal) hideModal(); });
navPrev.addEventListener('click', navigatePrevious);
navNext.addEventListener('click', navigateNext);
document.addEventListener('keydown', (e) => {
    if (mediaModal.style.display === 'block') {
        switch (e.key) {
            case 'Escape': hideModal(); break;
            case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); navigatePrevious(); break;
            case 'ArrowRight': case 'ArrowDown': e.preventDefault(); navigateNext(); break;
        }
    }
});

// Preload khi trang load
window.addEventListener('load', async () => {
    passwordInput.focus();
    try {
        preloadedData = await preloadAndDecryptMedia();
        // === KÍCH HOẠT TÍNH NĂNG KÉO THẢ SAU KHI DỮ LIỆU ĐÃ SẴN SÀNG ===
        if (preloadedData && preloadedData.successCount > 0) {
            setupDragAndDropUnlock();
        }
    } catch (error) {
        console.error('Lỗi preload:', error);
        passwordMessage.innerHTML = '<div class="error-message">Lỗi tải dữ liệu!</div>';
    }
});






























const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');

// Thiết lập kích thước canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Các ký tự sẽ rơi xuống
const characters = '`1234567890-=!@#$%^&*()_+qwertyuiop[]\QWERTYUIOP{}|asdfghjklASDFGHJKL:"zxcvbnm,./ZXCVBNM<>?';
const charactersArray = characters.split('');

// Mảng chứa các cột
const columns = canvas.width / 20;
const drops = [];

// Khởi tạo vị trí ban đầu ngẫu nhiên cho mỗi cột
for (let i = 0; i < columns; i++) {
    drops[i] = Math.floor(Math.random() * canvas.height / 20);
}

let speed = 50;

const mainColor = '#00aaff';

function draw() {
    // Tạo hiệu ứng mờ dần
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Thiết lập màu và font
    ctx.fillStyle = mainColor;
    ctx.font = 'bold 15px Courier New';
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 15;

    // Vẽ các ký tự rơi xuống
    for (let i = 0; i < drops.length; i++) {
        // Chọn ký tự ngẫu nhiên
        const text = charactersArray[Math.floor(Math.random() * charactersArray.length)];

        // Vẽ ký tự với hiệu ứng sáng
        ctx.fillText(text, i * 20, drops[i] * 20);

        // Thêm hiệu ứng sáng cho ký tự đầu
        if (drops[i] * 20 > 20) {
            ctx.shadowBlur = 5;
            ctx.fillStyle = mainColor + '60';
            ctx.fillText(charactersArray[Math.floor(Math.random() * charactersArray.length)], i * 20, (drops[i] - 1) * 20);
            ctx.fillStyle = mainColor;
            ctx.shadowBlur = 15;
        }

        // Reset vị trí khi ký tự chạm đáy hoặc ngẫu nhiên
        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }

        drops[i]++;
    }

    // Reset shadow
    ctx.shadowBlur = 0;
}

function animate() {
    draw();
    setTimeout(() => {
        requestAnimationFrame(animate);
    }, 200 - speed);
}

// Xử lý resize window
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Cập nhật số cột và khởi tạo vị trí ngẫu nhiên
    const newColumns = canvas.width / 20;
    while (drops.length < newColumns) {
        drops.push(Math.floor(Math.random() * canvas.height / 20));
    }
    drops.length = newColumns;
});

// Bắt đầu animation
animate();