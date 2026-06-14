const startScanBtn = document.getElementById("startScanBtn");
const stopScanBtn = document.getElementById("stopScanBtn");
const cameraPreview = document.getElementById("cameraPreview");
const statusLog = document.getElementById("statusLog");
const barcodeResult = document.getElementById("barcodeResult");
const manualBarcode = document.getElementById("manualBarcode");
const addManualBtn = document.getElementById("addManualBtn");
const itemList = document.getElementById("itemList");

let codeReader = null;
let scannerLocked = false;
let candidateCode = null;
let candidateCount = 0;

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
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      return {
        found: true,
        name:
          data.product.product_name ||
          data.product.product_name_en ||
          data.product.generic_name ||
          "Unnamed product",
        brand: data.product.brands || "",
        image: data.product.image_front_small_url || data.product.image_url || ""
      };
    }

    return {
      found: false,
      name: "Unknown product",
      brand: "",
      image: ""
    };
  } catch (error) {
    log("Product lookup failed. Maybe internet/CORS issue.");
    return {
      found: false,
      name: "Lookup failed",
      brand: "",
      image: ""
    };
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
        ? `<img src="${product.image}" alt="${product.name}" style="max-width:80px;margin-top:8px;border-radius:8px;">`
        : ""
    }
  `;

  itemList.prepend(item);

  if (product.found) {
    log(`Product found: ${product.name}`);
  } else {
    log("Product not found in Open Food Facts. You can still save the barcode.");
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
    log("Initializing scanner...");

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    codeReader = new ZXing.BrowserMultiFormatReader(hints);

    const videoInputDevices = await codeReader.listVideoInputDevices();

    if (!videoInputDevices || videoInputDevices.length === 0) {
      log("No camera found.");
      return;
    }

    const rearCamera = videoInputDevices.find(device => {
      const label = device.label.toLowerCase();
      return label.includes("back") || label.includes("rear") || label.includes("environment");
    });

    const selectedDeviceId = rearCamera
      ? rearCamera.deviceId
      : videoInputDevices[videoInputDevices.length - 1].deviceId;

    log("Scanner running.");
    log("Hold the barcode steady until it confirms.");

    codeReader.decodeFromVideoDevice(
      selectedDeviceId,
      cameraPreview,
      async (result, error) => {
        if (scannerLocked) return;

        if (result) {
          const rawCode = result.getText();
          const validCode = normalizeBarcode(rawCode);

          if (!validCode) {
            log(`Ignored invalid scan: ${rawCode}`);
            return;
          }

          // Stability filter: same valid code must appear twice
          if (candidateCode === validCode) {
            candidateCount += 1;
          } else {
            candidateCode = validCode;
            candidateCount = 1;
          }

          log(`Candidate barcode: ${validCode} (${candidateCount}/2)`);

          if (candidateCount >= 2) {
            scannerLocked = true;
            log("Barcode confirmed. Stopping scanner...");

            stopScanner();

            await addItemToList(validCode, "live camera");
          }
        }

        if (error && !(error instanceof ZXing.NotFoundException)) {
          console.warn(error);
        }
      }
    );
  } catch (error) {
    log(`ERROR: ${error.name || "UnknownError"}`);
    log(error.message || String(error));
    alert("Scanner failed. Check the status box.");
  }
}

function stopScanner() {
  try {
    if (codeReader) {
      codeReader.reset();
      log("Scanner stopped.");
    }

    cameraPreview.srcObject = null;
  } catch (error) {
    console.error(error);
  }
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
