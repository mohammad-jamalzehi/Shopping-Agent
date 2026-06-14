const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const cameraPreview = document.getElementById("cameraPreview");
const statusLog = document.getElementById("statusLog");
const manualBarcode = document.getElementById("manualBarcode");
const addManualBtn = document.getElementById("addManualBtn");
const itemList = document.getElementById("itemList");
const cameraFileInput = document.getElementById("cameraFileInput");

let currentStream = null;

function log(message) {
  const time = new Date().toLocaleTimeString();
  statusLog.textContent += `\n[${time}] ${message}`;
}

function clearLog() {
  statusLog.textContent = "Ready...";
}

async function startCamera() {
  clearLog();

  try {
    log("Checking camera support...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log("getUserMedia is not supported in this browser.");
      log("Use the iPhone fallback file input instead.");
      return;
    }

    log("Requesting rear camera permission...");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    currentStream = stream;
    cameraPreview.srcObject = stream;

    log("Camera started successfully.");
    log("If this is the front camera, your browser ignored rear-camera preference.");
  } catch (error) {
    log(`ERROR: ${error.name}`);
    log(error.message);

    if (error.name === "NotAllowedError") {
      log("Permission was blocked or denied.");
      log("On iPhone: Settings > Apps > Chrome > Camera > Allow.");
      log("Also check: Settings > Privacy & Security > Camera > Chrome ON.");
    }

    if (error.name === "NotFoundError") {
      log("No camera was found.");
    }

    if (error.name === "NotReadableError") {
      log("Camera may already be used by another app.");
    }

    alert("Camera failed. Check the status box for details.");
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    cameraPreview.srcObject = null;
    currentStream = null;
    log("Camera stopped.");
  } else {
    log("No active camera stream to stop.");
  }
}

function addBarcodeItem(barcode) {
  const cleaned = barcode.trim();

  if (!cleaned) {
    alert("Please enter a barcode.");
    return;
  }

  const item = document.createElement("li");
  item.textContent = `Barcode: ${cleaned} — Product lookup not connected yet`;
  itemList.appendChild(item);

  manualBarcode.value = "";
  log(`Added barcode manually: ${cleaned}`);
}

startCameraBtn.addEventListener("click", startCamera);
stopCameraBtn.addEventListener("click", stopCamera);

addManualBtn.addEventListener("click", () => {
  addBarcodeItem(manualBarcode.value);
});

manualBarcode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addBarcodeItem(manualBarcode.value);
  }
});

cameraFileInput.addEventListener("change", () => {
  if (cameraFileInput.files && cameraFileInput.files[0]) {
    log(`Image selected: ${cameraFileInput.files[0].name}`);
    log("Next step: connect OCR/barcode reading from this uploaded image.");
  }
});
