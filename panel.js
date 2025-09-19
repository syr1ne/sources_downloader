const logDiv = document.getElementById("log");
const input = document.getElementById("allowedExt");
const seenUrls = {};

function urlToFilename(url) {
    let path = url.pathname;

    if (path.startsWith("/")) path = path.slice(1);

    path = path.split("/").map(part =>
        part.replace(/[\\?%*:|"<>]/g, "_")
    ).join("/");

    return path || "unnamed_file";
}

// filter urls with allowed extensions
function hasAllowedExtension(url) {
    if (input.value == "") {
        return true;
    }
    const allowedExtensions = input.value
        .split(",")
        .map(ext => ext.trim())
        .filter(ext => ext !== "");
    return allowedExtensions.some(ext => url.pathname.endsWith(ext));
}

chrome.devtools.inspectedWindow.eval("window.location.hostname", (result, isException) => {
    if (isException || !result) {
        console.error("Failed to get hostname of inspected window.");
        logDiv.innerText = "Failed to get hostname of inspected window.";
        return;
    }

    window.currentPageDomain = result;

    // start listening after domain is known
    chrome.devtools.network.onRequestFinished.addListener((request) => {
        try {
            const url = new URL(request.request.url);

            if (url.hostname !== window.currentPageDomain) return;
            if (!hasAllowedExtension(url)) return;

            const filename = urlToFilename(url);
            if (seenUrls[filename]) return; // Skip duplicates

            request.getContent((body, encoding) => {
                if (!body) return; // Skip if no content
                const decoded = encoding === "base64" ? atob(body) : body;
                seenUrls[filename] = decoded;

                const div = document.createElement("div");
                div.className = "url";
                div.textContent = url.href;
                logDiv.appendChild(div);
            });

        } catch (err) {
            console.error("Failed to handle request:", request.request.url, err);
            logDiv.innerText = "Failed to handle request:", request.request.url, err;
        }
    });
});

// clear seenUrls and logs
document.getElementById("clearBtn").addEventListener("click", () => {
    Object.keys(seenUrls).forEach(k => delete seenUrls[k]);
    logDiv.innerHTML = "";
});

// download the files as zip
document.getElementById("downloadBtn").addEventListener("click", async () => {
    const zip = new JSZip();

    Object.entries(seenUrls).forEach(([filename, content]) => {
        zip.file(filename, content);
    });

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "responses.zip";
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (e) {
        console.error("Error generating ZIP:", e);
        logDiv.innerText = "Error generating ZIP:", e;
    }
});