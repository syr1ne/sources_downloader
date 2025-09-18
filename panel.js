const logDiv = document.getElementById("log");

let currentPageDomain = null;
const seenUrls = new Set();

// Define the file extensions to include
let allowedExtensions = [];

// function to filter url with allowed extensions
function hasAllowedExtension(url) {
    allowedExtensions = document.getElementById("allowedExt").value.split(",").map(ext => ext.trim()).filter(ext => ext !== "");
    return allowedExtensions.some(ext => url.pathname.endsWith(ext));
}

// get the hostname of current page
chrome.devtools.inspectedWindow.eval("window.location.hostname", (result, exceptionInfo) => {
    if (!exceptionInfo && result) {
        currentPageDomain = result;
        console.log("Current page domain:", currentPageDomain);
    } else {
        console.warn("Failed to get current domain:", exceptionInfo);
    }
});

// listen for network request
chrome.devtools.network.onRequestFinished.addListener((request) => {
    if (!currentPageDomain) return;

    try {
        const url = new URL(request.request.url);

        // Filter by current active domain
        if (url.hostname !== currentPageDomain) return;

        // filter out duplicates
        if (seenUrls.has(url.href)) return;
        seenUrls.add(url.href);

        // filter out URLs that don't end with allowed extensions
        if (!hasAllowedExtension(url)) return;

        // Display the URL
        const div = document.createElement("div");
        div.className = "url";
        div.textContent = url.href;
        logDiv.appendChild(div);

    } catch (err) {
        console.error("Failed to parse URL:", request.request.url, err);
    }
});

// clear button
document.getElementById("clearBtn").addEventListener("click", () => {
    seenUrls.clear();
    logDiv.innerHTML = "";
});

// download as zip
document.getElementById("downloadBtn").addEventListener("click", () => {
  // Incomplete: feature to download
});