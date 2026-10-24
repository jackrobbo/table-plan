// Runs on Table Plan only. Leaves a marker so the app knows the extension is installed (and shows the "Fill my trolley" button).
document.documentElement.dataset.tableplanExt = chrome.runtime.getManifest().version;
