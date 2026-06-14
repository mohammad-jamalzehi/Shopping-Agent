const startScanBtn = document.getElementById("startScanBtn");
const stopScanBtn = document.getElementById("stopScanBtn");
const cameraPreview = document.getElementById("cameraPreview");
const statusLog = document.getElementById("statusLog");
const barcodeResult = document.getElementById("barcodeResult");
const manualBarcode = document.getElementById("manualBarcode");
const addManualBtn = document.getElementById("addManualBtn");
const itemList = document.getElementById("itemList");

let codeReader = null;
let currentStream = null;
let scanTimer = null;
let scannerLocked = false;
let candidateCode = null;
let candidateCount = 0;

const cropCanvas = document.createElement("canvas");
const cropContext = cropCanvas.getContext("2d", { willReadFrequently: true });

function log(message) {
  const time = new Date().toLocaleTimeString();
  statusLog.textContent += `\n[${time}] ${message}`;
  statusLog.scrollTop = statusLog.scrollHeight;
}

function resetLog() {
  statusLog.textContent = "Ready.";
}

function onlyDigits(value) {
  return String(value).replace(/\D/g, "");
}

function isValidEAN13(code) {
  code = onlyDigits(code);
  if (!/^\d{13}$/.test(code)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(code[12]);
}

function isValidEAN8(code) {
  code = onlyDigits(code);
  if (!/^\d{8}$/.test(code)) return false;

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += Number(code[i]) * (i % 2 === 0 ? 3 : 1);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(code[7]);
}

function isValidUPCA(code) {
  code = onlyDigits(code);
  if (!/^\d{12}$/.test(code)) return false;

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += Number(code[i]) * (i % 2 === 0 ? 3 : 1);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(code[11]);
}

function normalizeBarcode(rawCode) {
  const code = onlyDigits(rawCode);

  if (isValidEAN13(code)) return code;
  if (isValidUPCA(code)) return code;
  if (isValidEAN8(code)) return code;

  return null;
}

async function lookupProduct(barcode) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      return {
        found: true,
        name: data.product.product_name || data.product.product_name_en || data.product.generic_name || "Unnamed product",
        brand: data.product.brands || "",
        image: data.product.image_front_small_url || data.product.image_url || ""
      };
    }

    return { found: false, name: "Unknown product", brand: "", image: "" };
  } catch (error) {
    log("Product lookup failed.");
    return { found: false, name: "Lookup failed", brand: "", image: "" };
  }
}

async function addItemToList(barcode, source = "scanner") {
  const validBarcode = normalizeBarcode(barcode);

  if (!validBarcode) {
    log(`Rejected invalid barcode: ${barcode}`);
    return;
  }

  barcodeResult.textContent = validBarcode;
  log(`Valid barcode confirmed: ${validBarcode}`);
  log("Looking up product name...");

  const product = await lookupProduct(validBarcode);

  const item = document.createElement("li");
  item.innerHTML = `
    <div class="item-title">${product.name}</div>
    <div class="item-note">
      Barcode: ${validBarcode}<br>
      ${product.brand ? "Brand: " + product.brand + "<br>" : ""}
      Source: ${source}
    </div>
    ${
      product.image
        ? `<img class="product-image" src="${product.image}" alt="${product.name}">`
        : ""
    }
  `;

  itemList.prepend(item);

  if (product.found) {
    log(`Product found: ${product.name}`);
  } else {
    log("Product not found in Open Food Facts.");
  }
}

async function startScanner() {
  resetLog();

  scannerLocked = false;
  candidateCode = null;
  candidateCount = 0;

  if (!window.ZXing) {
    log("ZXing library did not load.");
    return;
  }

  try {
    log("Starting camera...");
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    cameraPreview.srcObject = currentStream;
    await cameraPreview.play();

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    codeReader = new ZXing.BrowserMultiFormatReader(hints);

    log("Scanner running.");
    log("Only the tighter center box is scanned.");
    log("Move the product, do not zoom the camera.");

    scanTimer = setInterval(scanCropArea, 180);
  } catch (error) {
    log(`ERROR: ${error.name || "UnknownError"}`);
    log(error.message || String(error));
    alert("Scanner failed. Check the status box.");
  }
}

async function scanCropArea() {
  if (scannerLocked) return;
  if (!cameraPreview.videoWidth || !cameraPreview.videoHeight) return;

  const videoWidth = cameraPreview.videoWidth;
  const videoHeight = cameraPreview.videoHeight;

  // Match mobile CSS ROI approximately:
  // left 16%, top 40%, width 68%, height 22%
  const sourceX = videoWidth * 0.16;
  const sourceY = videoHeight * 0.40;
  const sourceW = videoWidth * 0.68;
  const sourceH = videoHeight * 0.22;

  cropCanvas.width = Math.round(sourceW);
  cropCanvas.height = Math.round(sourceH);

  cropContext.drawImage(
    cameraPreview,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  try {
    const result = await codeReader.decodeFromCanvas(cropCanvas);
    const rawCode = result.getText();
    const validCode = normalizeBarcode(rawCode);

    if (!validCode) {
      return;
    }

    if (candidateCode === validCode) {
      candidateCount += 1;
    } else {
      candidateCode = validCode;
      candidateCount = 1;
    }

    log(`Candidate: ${validCode} (${candidateCount}/2)`);

    if (candidateCount >= 2) {
      scannerLocked = true;
      stopScanner();
      await addItemToList(validCode, "tight scan box");
    }
  } catch (error) {
    // Normal while searching.
  }
}

function stopScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  if (cameraPreview) {
    cameraPreview.srcObject = null;
  }

  log("Scanner stopped.");
}

async function addManualBarcode() {
  scannerLocked = true;
  stopScanner();

  const code = manualBarcode.value.trim();

  if (!code) {
    alert("Please enter a barcode.");
    return;
  }

  await addItemToList(code, "manual entry");
  manualBarcode.value = "";
}

startScanBtn.addEventListener("click", startScanner);
stopScanBtn.addEventListener("click", stopScanner);
addManualBtn.addEventListener("click", addManualBarcode);

manualBarcode.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    addManualBarcode();
  }
});

window.addEventListener("beforeunload", stopScanner);
