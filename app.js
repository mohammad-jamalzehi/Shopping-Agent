const video = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const lookupBtn = document.getElementById('lookupBtn');
const addBtn = document.getElementById('addBtn');
const clearBtn = document.getElementById('clearBtn');
const barcodeInput = document.getElementById('barcodeInput');
const productName = document.getElementById('productName');
const category = document.getElementById('category');
const quantity = document.getElementById('quantity');
const expiry = document.getElementById('expiry');
const scanStatus = document.getElementById('scanStatus');
const inventoryEl = document.getElementById('inventory');

let stream = null;
let detector = null;
let scanTimer = null;

const sampleProducts = {
  '8076809513669': 'Barilla Spaghetti n.5 500g',
  '8000500310427': 'Nutella 450g',
  '8001090000017': 'Example Italian Grocery Product'
};

function loadInventory() {
  return JSON.parse(localStorage.getItem('inventory') || '[]');
}

function saveInventory(items) {
  localStorage.setItem('inventory', JSON.stringify(items));
  renderInventory();
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(dateStr);
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}

function renderInventory() {
  const items = loadInventory();
  inventoryEl.innerHTML = '';
  if (!items.length) {
    inventoryEl.innerHTML = '<p class="empty">No items yet. Scan your first product.</p>';
    return;
  }
  items.sort((a,b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
  for (const item of items) {
    const left = daysUntil(item.expiry);
    const div = document.createElement('div');
    div.className = 'item';
    if (left !== null && left < 0) div.classList.add('expired');
    else if (left !== null && left <= 3) div.classList.add('expiring');
    const expiryText = item.expiry
      ? left < 0 ? `Expired ${Math.abs(left)} day(s) ago` : `Expires in ${left} day(s)`
      : 'No expiry date';
    div.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <span class="meta">${escapeHtml(item.category)} · Qty ${escapeHtml(String(item.quantity))}</span>
      <span class="meta">Barcode: ${escapeHtml(item.barcode || 'N/A')}</span>
      <span class="meta">${escapeHtml(expiryText)}</span>
    `;
    inventoryEl.appendChild(div);
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag]));
}

async function startCamera() {
  if (!('BarcodeDetector' in window)) {
    scanStatus.textContent = 'Live barcode scanning is not supported in this browser. Type the barcode manually, or try Chrome on Android.';
    return;
  }

  detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
  scanStatus.textContent = 'Camera started. Point it at a barcode.';

  scanTimer = setInterval(async () => {
    try {
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        barcodeInput.value = code;
        scanStatus.textContent = `Detected barcode: ${code}`;
        lookupProduct();
      }
    } catch (err) {
      scanStatus.textContent = 'Scanning error: ' + err.message;
    }
  }, 700);
}

function stopCamera() {
  if (scanTimer) clearInterval(scanTimer);
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  scanTimer = null;
  video.srcObject = null;
  scanStatus.textContent = 'Camera stopped.';
}

async function lookupProduct() {
  const code = barcodeInput.value.trim();
  if (!code) {
    scanStatus.textContent = 'Enter or scan a barcode first.';
    return;
  }

  if (sampleProducts[code]) {
    productName.value = sampleProducts[code];
    scanStatus.textContent = 'Product found in local sample database.';
    return;
  }

  // Online lookup using Open Food Facts. Works only when internet is available.
  try {
    scanStatus.textContent = 'Looking up product online...';
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const data = await res.json();
    if (data.status === 1 && data.product) {
      productName.value = data.product.product_name || data.product.generic_name || 'Unnamed product';
      scanStatus.textContent = 'Product found online.';
    } else {
      scanStatus.textContent = 'Product not found. Type the name manually.';
      productName.value = '';
    }
  } catch (err) {
    scanStatus.textContent = 'Online lookup failed. Type the product name manually.';
  }
}

function addItem() {
  const item = {
    barcode: barcodeInput.value.trim(),
    name: productName.value.trim(),
    category: category.value,
    quantity: Number(quantity.value || 1),
    expiry: expiry.value
  };
  if (!item.name) {
    scanStatus.textContent = 'Product name is required.';
    return;
  }
  const items = loadInventory();
  items.push(item);
  saveInventory(items);
  scanStatus.textContent = 'Item added to inventory.';
  barcodeInput.value = '';
  productName.value = '';
  quantity.value = 1;
  expiry.value = '';
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
lookupBtn.addEventListener('click', lookupProduct);
addBtn.addEventListener('click', addItem);
clearBtn.addEventListener('click', () => saveInventory([]));
renderInventory();
